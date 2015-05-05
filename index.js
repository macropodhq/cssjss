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

    rule.selectors.forEach(function(selector) {
      bits.push("exports[" + JSON.stringify(selector) + "] = ");
    });

    var hasExtensions = false;

    rule.declarations.forEach(function(declaration) {
      if (declaration.property !== "extend") {
        return;
      }

      if (!hasExtensions) {
        bits.push("Object.extend({}, ");
        hasExtensions = true;
      }

      bits.push(declaration.value + ", ");
    });

    bits.push("{\n");

    rule.declarations.forEach(function(declaration) {
      if (declaration.type !== "declaration") {
        return;
      }

      switch (declaration.property) {
      case "extend":
        break;
      default:
        bits.push("  " + JSON.stringify(declaration.property) + ": " + JSON.stringify(declaration.value) + ",\n");
      }
    });

    bits.push("}");

    if (hasExtensions) {
      bits.push(")");
    }

    bits.push(";\n");

    parts = parts.concat(bits.join(""));
  });

  return done(parts.join("\n"));
};
