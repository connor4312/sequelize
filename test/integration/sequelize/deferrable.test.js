'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , assert = chai.assert
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , _ = require('lodash')
  , Sequelize = require(__dirname + '/../../../index')
  , config = require(__dirname + '/../../config/config')
  , moment = require('moment')
  , Transaction = require(__dirname + '/../../../lib/transaction')
  , sinon = require('sinon')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Sequelize'), function() {
  if (dialect !== 'postgres') {
    return;
  }

  beforeEach(function () {
    this.run = function (deferrable, options) {
      var userTableName = 'users_' + config.rand();

      var User = this.sequelize.define(
        'User', { name: Sequelize.STRING }, { tableName: userTableName }
      );

      var Task = this.sequelize.define(
        'Task', {
          title: Sequelize.STRING,
          user_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: userTableName,
            referencesKey: 'id',
            referencesDeferrable: deferrable
          }
        }, {
          tableName: 'tasks_' + config.rand()
        }
      );

      return User.sync({ force: true }).bind(this).then(function () {
        return Task.sync({ force: true });
      }).then(function () {
        return this.sequelize.transaction(
          options || { deferrable: Sequelize.Deferrable.ALL_DEFERRED },
          function (t) {
            return Task
              .create({ title: 'a task', user_id: -1 }, { transaction: t })
              .then(function (task) {
                return [task, User.create({}, { transaction: t })];
              })
              .spread(function (task, user) {
                task.user_id = user.id;
                return task.save({ transaction: t });
              });
          }
        );
      });
    }
  });

  describe('Deferrable', function () {
    describe('NOT_DEFERRABLE', function () {
      it('does not allow the violation of the foreign key constraint', function () {
        return this
          .run(Sequelize.Deferrable.NOT_DEFERRABLE)
          .then(assert.fail, function (err) {
            expect(err.name).to.equal('SequelizeForeignKeyConstraintError');
          });
      });
    });

    describe('DEFERRABLE_INITIALLY_IMMEDIATE', function () {
      it('allows the violation of the foreign key constraint', function () {
        return this
          .run(Sequelize.Deferrable.DEFERRABLE_INITIALLY_IMMEDIATE)
          .then(function (task) {
            expect(task.title).to.equal('a task');
            expect(task.user_id).to.equal(1);
          }, assert.fail);
      });
    });

    describe('DEFERRABLE_INITIALLY_DEFERRED', function () {
      it('allows the violation of the foreign key constraint', function () {
        return this
          .run(Sequelize.Deferrable.DEFERRABLE_INITIALLY_DEFERRED, {})
          .then(function (task) {
            expect(task.title).to.equal('a task');
            expect(task.user_id).to.equal(1);
          }, assert.fail);
      });
    });
  });
});
