
function trycatch(method, successHandler, errorHandler) {

    var isCalled = false;
    var isSuccess = false;
    var isError = false;
    var err, res;

    function flush() {
        if (isCalled) {
            if (isError) {
                return errorHandler(err);
            } else if (isSuccess) {
                return successHandler(res);
            }
        }
    }

    try {
        method(function(result) {
            res = result;
            isSuccess = true;
            flush();
        }, function(error) {
            err = error;
            isError = true;
            flush();
        });
    } catch (error) {
        return errorHandler(error);
    }

    isCalled = true;
    flush();
}


export var SyncPromise = function SyncPromise(handler) {

    this.resolved = false;
    this.rejected = false;

    this.handlers = [];

    if (!handler) {
        return;
    }

    var self = this;

    trycatch(handler, function(res) {
        return self.resolve(res);
    }, function(err) {
        return self.reject(err);
    });
};

SyncPromise.resolve = function SyncPromiseResolve(value) {

    if (value && value.then) {
        return value;
    }

    return new SyncPromise().resolve(value);
};

SyncPromise.reject = function SyncPromiseResolve(error) {
    return new SyncPromise().reject(error);
};

SyncPromise.prototype.resolve = function (result) {
    if (this.resolved || this.rejected) {
        return this;
    }

    if (result && result.then) {
        throw new Error('Can not resolve promise with another promise');
    }

    this.resolved = true;
    this.value = result;
    this.dispatch();

    return this;
};

SyncPromise.prototype.reject = function(error) {
    if (this.resolved || this.rejected) {
        return this;
    }

    if (error && error.then) {
        throw new Error('Can not reject promise with another promise');
    }

    this.rejected = true;
    this.value = error;
    this.dispatch();

    return this;
};

SyncPromise.prototype.dispatch = function() {

    if (!this.resolved && !this.rejected) {
        return;
    }

    while (this.handlers.length) {

        var handler = this.handlers.shift();

        var result, error;

        try {
            if (this.resolved) {
                result = handler.onSuccess ? handler.onSuccess(this.value) : this.value;
            } else {
                if (handler.onError) {
                    result = handler.onError(this.value);
                } else {
                    error = this.value;
                }
            }
        } catch (err) {
            error = err;
        }

        if (result === this) {
            throw new Error('Can not return a promise from the the then handler of the same promise');
        }

        if (error) {
            handler.promise.reject(error);

        } else if (result && result.then) {
            result.then(res => { handler.promise.resolve(res); },
                    err => { handler.promise.reject(err); });

        } else {
            handler.promise.resolve(result);
        }
    }
};

SyncPromise.prototype.then = function(onSuccess, onError) {

    var promise = new SyncPromise();

    this.handlers.push({
        promise: promise,
        onSuccess: onSuccess,
        onError: onError
    });

    this.dispatch();

    return promise;
};

SyncPromise.prototype.catch = function(onError) {
    return this.then(null, onError);
};

SyncPromise.prototype.finally = function(handler) {
    return this.then(function(result) {
        handler();
        return result;
    }, function(error) {
        handler();
        throw error;
    });
};

SyncPromise.all = function(promises) {

    var promise = new SyncPromise();
    var count = promises.length;
    var results = [];

    for (var i = 0; i < promises.length; i++) {
        promises[i].then(function(result) {
            results[i] = result;
            count -= 1;
            if (count === 0) {
                promise.resolve(results);
            }
        }, function(err) {
            promise.reject(err);
        });
    }

    return promise;
};


export function patchPromise() {
    window.Promise = SyncPromise;
}
