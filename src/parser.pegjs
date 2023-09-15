// Simple Arithmetics Grammar
// ==========================
//
// Accepts expressions like "2 * (3 + 4)" and computes their value.


Multiple
  = stuff:((_)? Comparison (_? "\n" _?)*)+ {
	return {
    	multiple: stuff.map(item => item[1])
    }
  }

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


Variable "variable"
  = _ [$]Word { return {
  literal: text()
  } }

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

String
  = '"' ([\\]'"'/[^"\n])* '"' {
    return { string: JSON.parse(text()) }
  } / "'" ([\\]"'"/[^'\n])* "'" {
    return { string: JSON.parse(`"${text().slice(1, -1).replaceAll('"', '\\"')}"`) }
  }

    
FuncStatement
  = "func" _ args:(Word _ )+ {
  	return {
      keyword: "func",
      args: args.map(item => item[0])
    }
  }

EndStatement = "end" { return { keyword: 'end', args: [] } }

SetStatment
  = keyword:"set" _ vari:Word _ "to" _ value:Comparison {
    return {
      keyword: "set",
      args: [vari, value]
    }
  }

SingleStatment
  = keyword:("nonlocal") _ vari:Word {
    return {
      keyword: keyword,
      args: [vari]
    }
  }
  / "include" _ name:(Word/String) {
	return {
      keyword: "include",
      args: [name]
    }
  }

ReturnStatment
  = keyword:"return" _ vari:Comparison {
    return {
      keyword: "return",
      args: [vari]
    }
  }
  / "include" _ name:(Word/String) {
	return {
      keyword: "include",
      args: [name]
    }
  }
  
ChangeStatment
  = "change" _ vari:Word _ "by" _ value:Comparison {
    return {
      keyword: 'change',
      args: [vari, value]
    }
  }

Keyword
  = keyword:Word _ args:(((Comparison / Factor) _ )*) {
    return {
      keyword: keyword,
      args: args.map(item=>item[0])
    }
  }
  
FunctionCall
  = vari:Variable "(" args:(_? Factor _? ","? _?)* ")" { return {
  call: vari,
  args: args.map(item=>item[1])
  } }

Integer "integer"
  = _ [-]?[0-9]+([.][0-9]+)? { return {
  literal: text()
  } }
Factor
  = "(" _ expr:Comparison _ ")" { return expr; }
  / ReturnStatment / String / FuncStatement / SingleStatment / ChangeStatment / SetStatment / Keyword / FunctionCall / Integer / Variable

_ "whitespace"
  = [ \t\r]*

Word = [a-zA-Z_-][a-zA-Z_\-0-9.]* { return text() }