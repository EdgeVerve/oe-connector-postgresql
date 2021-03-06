const should = require('should');
let db = null;
describe('Auto-create schema with sequence support', function () {
  before(function (done) {
    db = global.getDataSource();

    // standard sequence
    db.define('TestSchema', {
      reservationId: {
        type: 'number',
        postgresql: {
          sequence: {
            type: 'standard',
            bigSerial: false
          }
        },
        id: true
      },
      personName: {
        type: 'string'
      }
    });

    // simple sequence
    db.define('TestSchema2', {
      reservationId: {
        type: 'number',
        postgresql: {
          sequence: {
            type: 'simple',
            name: 'reservation_sequence'
          }
        },
        id: true
      },
      firstName: "string",
      "lastName": "string"
    });

    // complex sequence
    db.define('TestSchema3', {
      reservationId: {
        type: 'string',
        postgresql: {
          sequence: {
            type: 'complex',
            prefix: 'LMB',
            name: 'reservation_sequence',
            length: 10,
          }
        },
        id: true
      },
      firstName: 'string',
      lastName: 'string'
    });


    // var p = db.automigrate();
    // p.then(function(){
    //   return done();
    // }).catch(function(error){
    //   return done(error)
    // });
    db.automigrate(function (error) {
      console.log(error)
      return done(error)
    });
  });

  describe('standard sequence', function () {
    it('asserts that the table is created', function (done) {
      db.discoverModelProperties('testschema', (err, result) => {
        if (err) {
          done(err);
        }
        else {
          result.should.not.be.undefined;
          result.length.should.equal(2); // 3 - since id will be auto-populated
          done();
        }
      })
    });

    it('asserts that the reservationid is a column created and it has sequence suppport', function (done) {
      // let connector = db.connector;
      let query = 'SELECT column_default FROM INFORMATION_SCHEMA.columns WHERE table_name = \'testschema\' and column_name = \'reservationid\'';

      db.connector.executeSQL(query, null, {}, function (err, results) {
        if (err) {
          done(err);
        }
        else {
          results.length.should.equal(1);
          results[0].column_default.includes('_seq').should.be.true;
          done();
        }
      })

    });

    it('should assert that the reservationid field autogenerates as per sequence', function (done) {

      let Model = db.models['TestSchema'];
      Model.create.should.be.a.Function;
      Model.create([{ personName: 'foobar' }, { personName: 'foobaz' }], function (err, data) {
        if (err) {
          done(err);
        }
        else {
          data.should.be.Array;
          data.length.should.equal(2);
          data[data.length - 1].reservationId.should.equal(2);
          done();
        }
      });
    });
  });

  describe('simple sequence', function () {

    it('asserts that the reservationid is a column created and it has sequence suppport in testschema2', function (done) {
      // let connector = db.connector;
      let query = 'SELECT column_default FROM INFORMATION_SCHEMA.columns WHERE table_name = \'testschema2\' and column_name = \'reservationid\'';

      db.connector.executeSQL(query, null, {}, function (err, results) {
        if (err) {
          done(err)
        }
        else {
          results.length.should.equal(1);
          results[0].column_default.includes('reservation_sequence').should.be.true();
          done();
        }
      });
    });

    it('asserts that the sequence object is created in database', done => {
      let query = 'select * from information_schema.sequences where sequence_name = \'reservation_sequence\'';
      db.connector.executeSQL(query, null, {}, function (err, results) {
        if (err) {
          done(err);
        }
        else {
          // console.dir(results);
          results.length.should.equal(1);
          // results[0].sequence_name.should.exist;
          should.exist(results[0].sequence_name);
          results[0].sequence_name.should.equal('reservation_sequence');
          done();
        }
      });
    });

    it('asserts that the created sequence increments by 1', done => {
      var Model = db.models['TestSchema2'];
      var data = [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Contoso' }
      ];

      Model.create(data, function (err) {
        if (err) {
          done(err);
        }
        else {
          db.connector.executeSQL('select last_value from reservation_sequence', null, {}, function (err, result) {
            if (err) {
              done(err);
            }
            else {
              result[0].last_value.should.equal(2);
              done();
            }
          });
        }
      });
    });
  });

  describe('complex sequence', function () {
    it('should have created the table in the db', done => {
      let query = 'select count(*) from information_schema.tables where table_name = \'testschema3\'';
      db.connector.executeSQL(query, null, {}, function (err, result) {
        if (err) {
          done(err);
        }
        else {
          // console.dir(result);
          result.length.should.equal(1);
          result[0].count.should.equal(1);
          done();
        }
      });
    });

    it('should insert the record with the correct sequence pattern', done => {
      let data = [
        {
          firstName: 'John', lastName: 'Doe'
        },
        {
          firstName: 'Jane', lastName: 'Contoso'
        }
      ];

      let model = db.models['TestSchema3'];

      model.create(data, (err, results) => {
        if (err) {
          done(err);
        }
        else {
          results.length.should.equal(2);
          let query = `select last_value from reservation_sequence;`;
          db.connector.executeSQL(query, null, {}, (err, result) => {
            if (err) {
              done(err)
            }
            else {
              result[0].last_value.should.equal(4);
              done();
            }
          });
        }
      });
    });

    it('should insert a data directly', function (done) {
      let Model = db.models['TestSchema2'];

      var tableSchemaData = [
        {
          firstName: 'Joe', lastName: 'Root'
        },
        {
          firstName: 'Nathan Coulter', lastName: 'Lyon'
        },
        {
          firstName: 'Daniel A', lastName: 'Veetori'
        },
        {
          firstName: 'AB Benjamin', lastName: 'Develliers'
        },
        {
          firstName: 'Abraham Nicholas', lastName: 'Lincoln'
        },
        {
          firstName: 'Jammy Anderson', lastName: 'Buttler'
        }
      ];

      Model.create(tableSchemaData, (err) => {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    });

    it('supports queries using like', function (done) {
      let Model = db.models['TestSchema2'];
      Model.find({ where: { firstName: { like: '%Nicholas%' } } }, function (err, posts) {
        if (err) return done(err);
        posts.length.should.equal(1);
        posts[0].firstName.should.equal('Abraham Nicholas');
        done();
      });
    });

    it('supports like for no match', function (done) {
      let Model = db.models['TestSchema2'];
      Model.find({ where: { firstName: { like: '%Kohli%' } } }, function (err, posts) {
        if (err) return done(err);
        posts.length.should.equal(0);
        done();
      });
    });

    it('supports case insensitive queries using like', function (done) {
      let Model = db.models['TestSchema2'];
      Model.find({ where: { firstName: { ilike: '%nicholas%' } } }, function (err, posts) {
        if (err) return done(err);
        posts.length.should.equal(1);
        posts[0].firstName.should.equal('Abraham Nicholas');
        done();
      });
    });

    it('supports negative queries using nlike', function (done) {
      let Model = db.models['TestSchema2'];
      Model.find({ where: { firstName: { nlike: '%Nicholas%' } } }, function (err, posts) {
        if (err) return done(err);
        posts.length.should.equal(7);
        done();
      });
    });

    it('supports negative case sensitive queries using nilike', function (done) {
      let Model = db.models['TestSchema2'];
      Model.find({ where: { firstName: { nilike: '%nicholas%' } } }, function (err, posts) {
        if (err) return done(err);
        posts.length.should.equal(7);
        done();
      });
    });

    it('supports regex queries using like', function (done) {
      let Model = db.models['TestSchema2'];
      Model.find({
        where: {
          firstName: {
            like:
              new RegExp('nicholas', 'i')
          }
        }
      }, function (err, posts) {
        if (err) return done(err);
        posts.length.should.equal(1);
        posts[0].firstName.should.equal('Abraham Nicholas');
        done();
      });
    });
  });


});