// Simple Arithmetics Grammar
// ==========================
//
// Accepts expressions like "2 * (3 + 4)" and computes their value.

Comparison
  = head:Expression tail:(_ ("==" / ">" / "<" / ">=" / "<=" / "!=") _ Term)* {
      return tail.reduce(function(result, element) {
        return {
        	operator: element[1],
            first: result,
            second: element[3]
        }
      }, head);
    }

Expression
  = head:Term tail:(_ ("+" / "-") _ Term)* {
      return tail.reduce(function(result, element) {
        return {
        	operator: element[1],
            first: result,
            second: element[3]
        }
      }, head);
    }

Term
  = head:Factor tail:(_ ("*" / "/" / "%") _ Factor)* {
      return tail.reduce(function(result, element) {
        return {
        	operator: element[1],
            first: result,
            second: element[3]
        }
      }, head);
    }

FunctionCall
  = vari:Variable "(" args:(_ Factor _ ","?)* ")" { return {
  call: vari,
  args: args.map(item=>item[1])
  } }

Factor
  = "(" _ expr:Comparison _ ")" { return expr; }
  / FunctionCall / Integer / Variable

Integer "integer"
  = _ [-]?[0-9]+([.][0-9]+)? { return {
  literal: text()
  }; }

Variable "variable"
  = _ [$][a-zA-Z_-]+[a-zA-Z_\-0-9]* { return {
  literal: text()
  }; }

_ "whitespace"
  = [ \t\n\r]*