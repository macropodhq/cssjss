var css = require("css");
var path = require("path");

var IMPORT_REGEX = (/^"(.+?)"(?: as ([a-zA-Z_][a-zA-Z0-9_]+))?$/);

exports.parse = function parse(data) {
  var errors = [];

  done = function done(res) {
    switch (errors.length) {
      case 0:
        return res;

      case 1:
        throw errors[0];

      default: {
        var err = new Error(["multiple errors (see .errors for each one):", ""].concat(errors.map(function(e) {
          return e.toString();
        })).join("\n"));

        err.errors = errors;

        throw err;
      }
    }
  };

  var ast = css.parse(data);

  var parts = [];

  var hasImports = false;
  ast.stylesheet.rules.filter(function(e) {
    return e.type === "import";
  }).forEach(function(importStatement) {
    var m = IMPORT_REGEX.exec(importStatement.import);

    if (!m) {
      errors.push(new Error("invalid import syntax at " + importStatement.position.start.line + "," + importStatement.position.start.column));

      return null;
    }

    var filename = m[1];
    var importAs = m[2];
    if (!importAs) {
      importAs = path.basename(filename).split(".").shift();
    }

    parts.push("var " + importAs + " = require(" + JSON.stringify(filename) + ");");

    hasImports = true;
  });

  if (hasImports) {
    parts.push("");
  }

  ast.stylesheet.rules.filter(function(e) {
    return e.type === "rule";
  }).forEach(function(rule) {
    var bits = [];

    bits.push("(function() {");
    bits.push("  var o = {};", "");

    var hasRules = false;
    rule.declarations.forEach(function(declaration) {
      hasRules = true;

      if (declaration.type === "comment") {
        bits.push("  //" + declaration.comment);
        return;
      }

      if (declaration.type !== "declaration") {
        return;
      }

      switch (declaration.property) {
      case "extend":
        bits.push("  for (var k in " + declaration.value + ") {");
        bits.push("    o[k] = " + declaration.value + "[k];");
        bits.push("  }", "");
        break;
      default:
        bits.push("  o[" + JSON.stringify(declaration.property) + "] = " + JSON.stringify(declaration.value) + ";");
      }
    });

    if (hasRules) {
      bits.push("");
    }

    rule.selectors.forEach(function(selector) {
      bits.push("  exports[" + JSON.stringify(selector) + "] = o;");
    });

    bits.push("}());", "");

    parts = parts.concat(bits);
  });

  return done(parts.join("\n"));
};
