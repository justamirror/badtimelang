import { parse } from "https://deno.land/std@0.194.0/flags/mod.ts";
import { readline } from "https://deno.land/x/readline@v1.1.0/mod.ts";
const args = parse(Deno.args, {
  boolean: ["compile", "rcl", "debug", "help", "reload"],
  string: ["to"],
});

import parseDuration from "npm:parse-duration";
import * as path from "https://deno.land/std@0.188.0/path/mod.ts";
let parseExp;
if (args.reload) {
  const peg = (await import("./peg-0.10.0.js")).default;
  const stuff = peg.generate(
    new TextDecoder("utf-8").decode(
      await Deno.readFile(
        path.fromFileUrl(import.meta.resolve("./parser.pegjs")),
      ),
    ),
    {
      output: "source",
    }
  );

  await Deno.writeFile(
    path.fromFileUrl(import.meta.resolve("./parser.js")),
    new TextEncoder().encode('export default ' + stuff),
    {
      create: true
    }
  );

  parseExp = eval(stuff);
} else {
  parseExp = (await import("./parser.js")).default;
}

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

parse[""] = parse.second;

const SCOPE_TYPES = {
  AUTO: 0,
  NONLOCAL: 1,
};

class BT {
  #state;
  prefix;
  #wc;
  #functions;
  #imports;
  #stack;
  #scopes;
  #linenumber;
  constructor(debug = false) {
    this.#state = [];
    this.prefix = 0;
    this.#functions = {};
    this.#imports = {};
    this.#stack = [];
    this.#wc = 0;
    this.debug = debug;
    this.#scopes = {};
    this.#linenumber = 0;
  }
  get(variable, scope, set = false) {
    if (this.#scopes[scope] === void 0) {
      this.#scopes[scope] = {}
    }
    if (set) {
      if (this.#scopes[scope][variable] === void 0) {
        this.#scopes[scope][variable] = SCOPE_TYPES.AUTO;
      }
    }
    const keys = Object.keys(this.#scopes);
    const values = Object.values(this.#scopes);

    for (let i = keys.indexOf(scope); i >= 0; i--) {
      const thing = values[i][variable];
      if (thing === void 0 || thing === SCOPE_TYPES.NONLOCAL) {
        continue;
      }

      if (thing === SCOPE_TYPES.AUTO) {
        return `${keys[i]}_${variable}`;
      }
    }
    return "-1";
  }
  get state() {
    if (this.#stack.length) {
      return this.#stack[this.#stack.length - 1].stuff;
    }
    return this.#state;
  }
  pushState(state) {
    this.#linenumber++;
    if (this.debug) {
      console.log(`\x1b[30;47m${state.join(",")}\x1b[0m`);
    }
    this.state.push(state);
  }
  wait(time) {
    this.pushState([time, "JMPREL", "1"]);
  }

  async handleKeyword(prefix, command, ...args) {
    const v = (varname, p = prefix, set = false) => {
      return this.get(varname, p, set);
    };

    if (
      !([
        "sansAnimation",
        "sansBody",
        "sansTorso",
        "sansHead",
        "sansSweat",
        "sansX",
        "sansRepeat",
        "sansEndRepeat",
        "sansText",
        "set",
        "func",
        "include",
        "blackScreen",
        "sound",
        "music",
        "pause",
        "resume",
        "endAttack",
        "combatZoneSpeed",
        "combatZoneResize",
        "combatZoneResizeAuto",
        "getHeartPos",
        "angle",
        "boneH",
        "boneV",
        "boneHRepeat",
        "boneVRepeat",
        "sineBones",
        "boneStab",
        "gasterBlaster",
        "platform",
        "platformRepeat",
        "heartMode",
        "heartTeleport",
        "heartMaxFallSpeed",
        "sansSlam",
        "sansSlamDamage",
        "nonlocal",
        "while",
        "if",
        "func",
        "end",
        "change",
        "return"
      ].includes(command))
    ) {
      throw Error("Unknown command "+command)
    }

    if (command === "nonlocal") {
      this.#scopes[prefix][args[0]] = SCOPE_TYPES.NONLOCAL;
      return;
    }

    if (["func", "set", "change"].includes(command)) {
      args[0] = v(args[0], prefix, true);
    }

    if (command === "change") {
      command = 'set'

      args[1] = {
        operator: '+',
        first: {
          literal: `$${args[0]}`
        },
        second: args[1]
      }
    }

    if (command === "set") {
      const compd = args[1]
      this.pushState(["0", "SET", args[0], compd]);
      return `$${args[0]}`;
    }

    if (command === "include") {
      const textDecoder = new TextDecoder("utf-8");
      let filename = args[0];
      if (!filename.endsWith(".bt")) {
        filename = `${__dirname}/../std/${filename}.bt`;
      } else if (this.filename !== void 0) {
        filename = path.resolve(path.dirname(this.filename), filename)
      }
      const varname = v(path.basename(filename, ".bt"));
      await this.compile(textDecoder.decode(await Deno.readFile(filename)));
      this.#imports[varname] = this.prefix - 1;
      return;
    }

    if (command === "if" || command === "while") {
      const jump = this.#linenumber + 1;

      const varname = args[0];

      const command = ["0", "JMPNZ", null, varname];

      this.pushState(command);

      this.#stack.push({
        type: command,
        stuff: [],
        jump,
        command,
      });

      return;
    }

    if (command === "func") {
      this.#stack.push({
        type: "func",
        stuff: [],
        name: args[0],
        args: args.slice(1).map((item) => v(item, args[0], true)),
        asString: `func ${args.join(' ')}`,
        ind: this.#linenumber + 2
      });
      return;
    }

    if (command === "return") {
      let func_scope;
      for (let i = this.#stack.length - 1; i >= 0; i--) {
        if (this.#stack[i]?.type === "func") {
          func_scope = this.#stack[i];
          break;
        }
      }

      if (func_scope === void 0) {
        throw Error('Cannot use return outside of a function.')
      }

      this.pushState(["0", "SET", `RETURN_${func_scope.name}`, args[0]]);
      this.pushState(["0", "JMPABS", `$JB_${func_scope.name}`]);

      return;
    }

    if (this.#stack.length) {
      if (command === "end") {
        const obj = this.#stack.pop();

        if (obj.type === "func") {
          const { name: f, stuff, args: a, asString, ind } = obj;

          this.pushState(["0", "JMPREL", String(stuff.length + 3)]);

          for (const item of stuff) this.pushState(item);

          this.pushState(["0", "SET", `RETURN_${f}`, "0"]);
          this.pushState(["0", "JMPABS", `$JB_${f}`]);

          this.#functions[f] = {
            ind,
            args: a,
            asString,
          };

          return;
        } else if (obj.type === "if" || obj.type === "while") {
          const { stuff, command, jump } = obj;

          command[2] = String(
            this.#linenumber + 1 + (obj.type === "while" ? 1 : 0),
          );

          for (const item of stuff) this.pushState(item);

          if (obj.type === "while") {
            this.pushState(["0", "JMPABS", String(jump)]);
          }

          return;
        }
      }
    }

    command = `${command[0].toUpperCase()}${command.slice(1)}`;

    this.pushState(["0", command, ...args]);
  }

  to(file) {
    if (this.#wc) {
      this.wait(String(this.#wc));
      this.#wc = 0;
    }

    const state = this.#state;

    return Deno.writeFile(
      file,
      (new TextEncoder("utf-8")).encode(((state) => {
        let max = 0;
        for (const item of state) {
          max = Math.max(item.length, max);
        }
        let content = "";
        for (const item of state) {
          content += item.map((thing) => {
            if (
              typeof thing === "string" &&
              (thing.includes("\n") || thing.includes(",") ||
                thing.includes('"'))
            ) return `"${thing}"`;
            return thing;
          }).join(",") + (",".repeat(max - item.length)) + "\n";
        }
        return content;
      })(state)),
    );
  }
  static async from(file, debug = false) {
    const textDecoder = new TextDecoder("utf-8");

    const obj = new BT(debug);

    obj.filename = file;

    await obj.compile(textDecoder.decode(await Deno.readFile(file)));

    return obj;
  }
  async compile(code, prefix = String(this.prefix++)) {
    try {
      const stuff = parseExp.parse(code);
      return await this._compile(stuff, prefix, true)
    } catch (e) {
      if (e.location === void 0) throw e;
      e = new e.constructor(`[${this.filename}:ln${e.location.start.line}:column${e.location.start.column}] ${e.message}`);

      throw e
    }
  }
  async _compile(node, prefix = String(this.prefix++), topLevel=false) {
    if (node.multiple) {
      let value;
      for (let thing of node.multiple) {
        value = await this._compile(thing, prefix, topLevel)
      }
      return value
    }
    if (this.#stack.length && this.#stack[this.#stack.length - 1].name) {
      prefix = this.#stack[this.#stack.length - 1].name;
    }
    if (this.#scopes[prefix] === void 0) this.#scopes[prefix] = {};
    if (typeof node === "string" || node.string) {
      if (node.string && node.string.includes(',')) {
        throw Error("String literals cannot contain commas due to limitations of the CSV parser of sans battle simulator.")
      }
      return node.string || node;
    }
    if (node === void 0) return;
    if (node.keyword) {
      const value = await this.handleKeyword(prefix, node.keyword, ...(await this._compilea(node.args, prefix)));
      if (!topLevel && value === void 0) {
        throw Error("Statement " + node.keyword + " CANNOT be an input")
      }
      return value;
    }
    if (node.literal) {
      if (
        node.literal.startsWith("$")
      ) {
        if (this.#functions[node.literal.slice(1)] === void 0 && ['floor','degrees','radians','sin','cosin','angle','random'].includes(node.literal.slice(1))) {
          return "Builtin func "+(node.literal.slice(1))
        }
        node.literal = `$${this.get(node.literal.slice(1), prefix)}`;
      }
      if (
        node.literal.startsWith("$") && this.#functions[node.literal.slice(1)]
      ) {
        return this.#functions[node.literal.slice(1)].asString;
      }
      return node.literal;
    }
    const varname = `MATH_${this.prefix++}`;

    if ("+-/*%".includes(node.operator)) {
      this.pushState([
        "0",
        node.operator === "+"
          ? "ADD"
          : node.operator === "-"
          ? "SUB"
          : node.operator === "*"
          ? "MUL"
          : node.operator === "/"
          ? "DIV"
          : node.operator === "%"
          ? "MOD"
          : "???",
        varname,
        await this._compile(node.first, prefix),
        await this._compile(node.second, prefix),
      ]);
    } else if (["<=", "==", "!=", ">=", "<", ">"].includes(node.operator)) {
      const jump = this.#linenumber + 3;
      let command;
      const op = node.operator;
      if (op === "==") {
        command = [
          "JMPE",
          null,
          await this._compile(node.first, prefix),
          await this._compile(node.second, prefix),
        ];
      } else if (op == "!=") {
        command = [
          "JMPNE",
          null,
          await this._compile(node.first, prefix),
          await this._compile(node.second, prefix),
        ];
      } else if (op == "<") {
        command = [
          "JMPL",
          null,
          await this._compile(node.first, prefix),
          await this._compile(node.second, prefix),
        ];
      } else if (op == ">=") {
        command = [
          "JMPNL",
          null,
          await this._compile(node.first, prefix),
          await this._compile(node.second, prefix),
        ];
      } else if (op == ">") {
        command = [
          "JMPG",
          null,
          await this._compile(node.first, prefix),
          await this._compile(node.second, prefix),
        ];
      } else if (op == "<=") {
        command = [
          "JMPNG",
          null,
          await this._compile(node.first, prefix),
          await this._compile(node.second, prefix),
        ];
      }
      command[1] = jump;
      this.pushState(["0", ...command]);
      this.pushState(["0", "SET", varname, "1"]);
      this.pushState(["0", "JMPREL", "2"]);
      this.pushState(["0", "SET", varname, "0"]);
    } else if (node.call) {
      let call = node.call.literal.slice(1);
      const a = await this._compilea(node.args, prefix);
      if (this.#functions[this.get(call, prefix)] === void 0) {
        if (call === 'floor') {
          this.pushState(["0", "FLOOR", varname, a[0]]);
          return `$${varname}`
        }
        if (call === 'degrees') {
          this.pushState(["0", "DEG", varname, a[0]]);
          return `$${varname}`
        }
        if (call === 'radians') {
          this.pushState(["0", "RAD", varname, a[0]]);
          return `$${varname}`
        }
        if (call === 'sin') {
          this.pushState(["0", "SIN", varname, a[0]]);
          return `$${varname}`
        }
        if (call === 'cosin') {
          this.pushState(["0", "COS", varname, a[0]]);
          return `$${varname}`
        }
        if (call === 'angle') {
          this.pushState(["0", "ANGLE", varname, a[0], a[1], a[2], a[3]]);
          return `$${varname}`
        }
        if (call === 'random') {
          this.pushState(["0", "RND", varname, a[0]]);
          return `$${varname}`
        }
        throw Error("Unknown function "+call)
      }

      call = this.get(call, prefix)

      if (call.includes(".")) {
        const [i, vn] = call.split(".");

        call = `${this.#imports[i]}_${vn}`;
      }

      for (
        let i = 0;
        i < Math.min(this.#functions[call].args.length, a.length);
        i++
      ) {
        this.pushState(["0", "SET", this.#functions[call].args[i], a[i]]);
      }

      this.pushState([
        "0",
        "SET",
        `JB_${call}`,
        String(this.#linenumber),
      ]);
      this.pushState(["0", "JMPABS", this.#functions[call].ind]);
      return `$RETURN_${call}`;
    }

    return `$${varname}`;
  }
  async _compilea(stuff, prefix, topLevel) {
    const a = [];
    for (let thing of stuff) {
      a.push(await this._compile(thing, prefix, topLevel))
    }
    return a
  }
}

if (args.rcl) {
  let inst;
  console.log("Type 'exit' to exit.\n");
  if (args._[0] !== undefined) {
    inst = await BT.from(args._[0], args.debug);
  } else {
    inst = new BT(args.debug);
  }

  const prefix = inst.prefix - 1;

  const clear = new TextEncoder().encode(`\x1b[A\r\x1b[2K`);

  for await (const line of readline(Deno.stdin)) {
    const decoded = new TextDecoder().decode(line);
    if (args.debug) await Deno.stdout.write(clear);
    if (decoded.trim().toLowerCase() === "exit") {
      break;
    }
    await inst.compile(decoded, prefix);
  }

  await inst.to(
    args.to ||
      (args._[0] === void 0
        ? "output.csv"
        : (args._[0].split(".").slice(0, -1).concat(["csv"]).join("."))),
  );
} else if (args.compile) {
  const inst = await BT.from(args._[0], args.debug);

  await inst.to(
    args.to || (args._[0].split(".").slice(0, -1).concat(["csv"]).join(".")),
  );
} else if (args.help) {
  console.log(`badtime --help: This!
badtime [file] --rcl [--debug]: Activate input prompt, with an optional file to run.
badtime file --compile [--debug]: Compile a file.

--debug: Debug mode prints out compiled statements.
--refresh: Recompile parser.js`);
} else {
  console.log("No options supplied. Use badtime --help to view help");
}
