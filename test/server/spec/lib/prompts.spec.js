"use strict";

var _ = require("lodash");
var async = require("async");
var prompts = require("../../../../lib/prompts");
var Prompt = require("inquirer/lib/prompts/input");

require("../base.spec");

// Helpers
/**
 * Invoke `prompts` and callback with _expected_ error object.
 *
 * @param {Object}    init      Initialization object
 * @param {Function}  assertFn  Assertion function on `(err)`
 * @returns {void}
 */
var promptsWithErr = function (init, assertFn) {
  return function (cb) {
    prompts(init, function (err) {
      assertFn(err);
      cb();
    });
  };
};

/**
 * Invoke `prompts` and callback with data object, erroring when appropriate.
 *
 * @param {Object}    init      Initialization object
 * @param {Function}  [setupFn] (OPTIONAL) Setup state function
 * @param {Function}  assertFn  Assertion function on `(data)`
 * @returns {void}
 */
var promptsWithData = function (init, setupFn, assertFn) {
  var args = _.toArray(arguments);

  // Assert function is last.
  setupFn = args.length === 3 ? args[1] : _.noop;
  assertFn = args.length === 3 ? args[2] : args[1];

  return function (cb) {
    setupFn();
    prompts(init, function (err, data) {
      if (err) { return cb(err); }
      assertFn(data);
      cb();
    });
  };
};

describe("lib/prompts", function () {
  var runStub;

  beforeEach(function () {
    // Intercept all real stdin/stdout.
    runStub = sandbox.stub(Prompt.prototype, "run");
  });

  it("errors on invalid init object", function (done) {
    async.series([
      promptsWithErr(undefined, function (err) {
        expect(err)
          .to.be.an.instanceOf(Error).and
          .to.have.property("message", "Invalid init object");
      }),
      promptsWithErr(null, function (err) {
        expect(err)
          .to.be.an.instanceOf(Error).and
          .to.have.property("message", "Invalid init object");
      }),
      promptsWithErr({ prompts: "invalid-string" }, function (err) {
        expect(err)
          .to.be.an.instanceOf(Error).and
          .to.have.property("message").and
            .to.contain("Invalid prompts type");
      })
    ], done);
  });

  it("handles base cases", function (done) {
    async.series([
      promptsWithData({}, function (data) {
        expect(data).to.deep.equal({});
      }),
      promptsWithData({ prompts: [] }, function (data) {
        expect(data).to.deep.equal({});
      }),
      promptsWithData({ prompts: {}, derived: {} }, function (data) {
        expect(data).to.deep.equal({});
      })
    ], done);
  });

  it("creates derived data alone", function (done) {
    async.series([
      promptsWithData({
        derived: {
          foo: function (data, cb) { cb(null, "foo"); },
          bar: function (data, cb) { cb(null, "bar"); }
        }
      }, function (data) {
        expect(data).to.deep.equal({ foo: "foo", bar: "bar" });
      }),
      promptsWithData({
        derived: {
          deferred: function (data, cb) { _.defer(cb.bind(null, null, "foo")); }
        }
      }, function (data) {
        expect(data).to.deep.equal({ deferred: "foo" });
      })
    ], done);
  });

  it("handles derived data errors", function (done) {
    runStub.yields("user");

    async.series([
      promptsWithErr({
        prompts: {
          user: { message: "user" }
        },
        derived: {
          foo: function (data, cb) { cb(new Error("Derived Foo")); }
        }
      }, function (err) {
        expect(err)
          .to.be.an.instanceOf(Error).and
          .to.have.property("message").and
            .to.contain("Derived Foo");
      }),
      promptsWithErr({
        derived: {
          foo: function (data, cb) { cb(null, "foo"); },
          bar: function (data, cb) { cb(new Error("Derived Bar")); },
          baz: function (data, cb) { cb(null, "baz"); }
        }
      }, function (err) {
        expect(err)
          .to.be.an.instanceOf(Error).and
          .to.have.property("message").and
            .to.contain("Derived Bar");
      })
    ], done);
  });

  it("creates prompts data alone", function (done) {
    async.series([
      promptsWithData({
        prompts: {
          licenseDate: { message: "License date", default: "2016" }
        }
      }, function () {
        runStub
          .reset()
          .onCall(0).yields("2016");
      }, function (data) {
        expect(data).to.deep.equal({ licenseDate: "2016" });
      }),

      promptsWithData({
        prompts: {
          packageName: { message: "Package name" },
          packageDescription: { message: "Package description" }
        }
      }, function () {
        runStub
          .reset()
          .onCall(0).yields("whiz-bang")
          .onCall(1).yields("The Whiz Bang");
      }, function (data) {
        expect(data).to.deep.equal({
          packageName: "whiz-bang",
          packageDescription: "The Whiz Bang"
        });
      })
    ], done);
  });

  it("creates prompts and derived data", function (done) {
    promptsWithData({
      prompts: {
        year: { message: "License year" }
      },
      derived: {
        reverseYear: function (data, cb) {
          cb(null, data.year.split("").reverse().join(""));
        },
        independent: function (data, cb) { cb(null, "independent"); }
      }
    }, function () {
      runStub
        .reset()
        .onCall(0).yields("2016");
    }, function (data) {
      expect(data).to.deep.equal({
        year: "2016",
        reverseYear: "6102",
        independent: "independent"
      });
    })(done);
  });

});
