var uuidv4 = require('uuid/v4');

module.exports = mixinLock;

var transactionsMap = {};

/*!
 * @param {PostgreSQL} PostgreSQL connector class
 */
function mixinLock(PostgreSQL) {

    PostgreSQL.prototype.acquire = function(modelInstance, options, cb) {
        var self = this;
        self.beginTransaction('READ COMMITTED', function(err, tx) {              
                var transaction_guid = uuidv4();
                modelInstance.__data.transaction_guid = transaction_guid;
                transactionsMap[transaction_guid] = tx;
                self.observe('timeout', function(context, next) {
                    var err = new Error('could not start transaction');
                    throw err;
                });
                var sql = "SELECT * FROM \""  + modelInstance.constructor.modelName.toLowerCase() + 
                "\" where id = '" + modelInstance.id + "' and _version = '"  + 
                modelInstance._version + "' for update ";
                var params = [];
                self.query(sql, params, options, function (err, recs) {
                    if (err) {
                        console.error('my error ', err);
                        return cb(err);
                    }

                    if (recs.length === 0) {
                        error = new Error('did not find instance with id and version for locking ');
                        return cb(err);
                    }

                    if (recs.length > 1) {
                        error = new Error('Find multiple instance with id and name for locking ');
                        return cb(err);
                    }
                    return cb(null);
                });
            });
    }

    PostgreSQL.prototype.release = function(err, modelInstance, releaseLockCb, valid) {
                var transactionGuid = modelInstance.__data.transaction_guid;
                var transaction = transactionsMap[transactionGuid];
                this.commit(transaction, function(commitErr) {
                        delete transactionsMap[transactionGuid];
                        if (commitErr) {
                            return releaseLockCb(commitErr, valid);
                        } else {
                            if (err) {
                                return releaseLockCb(err, valid);
                            } else {
                                return releaseLockCb(null, valid);
                            }
                        }
                    });
            };
}
