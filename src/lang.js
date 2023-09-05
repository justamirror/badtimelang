import parse from "npm:parse-duration";
import * as path from "https://deno.land/std@0.188.0/path/mod.ts";
import parseExp from "./parser.js";

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

parse[""] = parse.second;

const SCOPE_TYPES = {
  AUTO: 0,
  NONLOCAL: 1
}

class BT {
  #state;
  prefix;
  #wc;
  #functions;
  #imports;
  #stack;
  #scopes;
  #linenumber;
  constructor(debug=false) {
    this.#state = [];
    this.prefix = 0;
    this.#functions = {};
    this.#imports = {}
    this.#stack = []
    this.#wc = 0;
    this.debug = debug;
    this.#scopes = {}
    this.#linenumber = 0;
  }
  get(variable, scope, set=false) {
    if (set) {
      if (this.#scopes[scope][variable] === void 0) this.#scopes[scope][variable] = SCOPE_TYPES.AUTO;
    }
    const keys = Object.keys(this.#scopes);
    const values = Object.values(this.#scopes);

    for (let i = keys.indexOf(scope); i >= 0; i--) {
      const thing = values[i][variable];
      if (thing === void 0 || thing === SCOPE_TYPES.NONLOCAL) {
        continue
      }

      if (thing === SCOPE_TYPES.AUTO) {
        return `${keys[i]}_${variable}`
      }
    }
    return '-1'
  }
  get state() {
    if (this.#stack.length) {
      return this.#stack[this.#stack.length-1].stuff
    }
    return this.#state
  }
  pushState(state) {
    this.#linenumber++;
    if (this.debug) {
      console.log(`\x1b[30;47m${state.join(',')}\x1b[0m`)
    }
    this.state.push(state);
  }
  wait(time) {
    this.pushState([time, 'JMPREL', '1'])
  }

  async compile(code, prefix=String(this.prefix++)) {
    const v = (varname, p=prefix, set=false) => {
      return this.get(varname, p, set)
    }
    if (this.#stack.length && this.#stack[this.#stack.length-1].name) {
      prefix = this.#stack[this.#stack.length-1].name;
    }
    if (this.#scopes[prefix] === void 0) this.#scopes[prefix] = {};
    if (code.includes('\n')) {
      for (const line of code.split('\n')) {
        await this.compile(line, prefix)
      }
      return
    }

    code = code.trim();
    if (!code) return;

    let args = Array.from(code.matchAll(/[^ "]+|"[^"]*?"(?: |$)/g)).map(item => {
      item = item[0].trim();

      if (item.startsWith('"') && item.endsWith('"')) {
        return JSON.parse(item.replaceAll('\n', '\\n'))
      }
      if (item.startsWith('$')) {
        return `$${v(item.slice(1))}`
      }
      return item
    });

    if (isNaN(args[0])) {
      args = ['0', ...args]
    }

    if (!([ "sansAnimation", "sansBody", "sansTorso", "sansHead", "sansSweat", "sansX", "sansRepeat", "sansEndRepeat", "sansText", "set", "func", "include", "blackScreen", "sound", "music", "pause", "resume", "endAttack", "combatZoneSpeed", "combatZoneResize", "combatZoneResizeAuto", "getHeartPos", "angle", "boneH", "boneV", "boneHRepeat", "boneVRepeat", "sineBones", "boneStab", "gasterBlaster", "platform", "platformRepeat", "heartMode", "heartTeleport", "heartMaxFallSpeed", "sansSlam", "sansSlamDamage", "nonlocal", "while", "if", "func", "end", "change" ].includes(args[1]))) {
      this.#wc += Number(args[0]);
      this.compileExpression(args.slice(1).join(' '), prefix)
      return
    }

    if (args[1] === "nonlocal") {
      this.#scopes[prefix][args[2]] = SCOPE_TYPES.NONLOCAL;
      this.#wc += Number(args[0])
      return
    }

    args[0] = String(parse(args[0], "s"));

    if (["func", "set", "change"].includes(args[1])) {
      args[2] = v(args[2], prefix, true)
    }

    if (args[1] === "change") {
      let ind = 3;
      args[1] = "set"
      if (args[3] === 'by') {
        ind = 4;
        args[3] = "to"
      }

      args[ind] = `$${args[2]} + (${args[ind]})`
    }

    if (args[1] === "set") {
      let slice = 3;
      if (args[3] === 'to') {
        slice = 4;
      }
      const compd = this.compileExpression(args.slice(slice).join(' '), prefix);
      if (!compd.startsWith("$MATH_")) {
        this.pushState([args[0], 'SET', args[2], compd]);
      } else {
        this.state[this.state.length-1][2] = args[2]
      }
      return
    }
  
    if (args[1] === 'include') {
      const textDecoder = new TextDecoder('utf-8');
      this.#wc += Number(args[0]);
      let filename = args[2];
      if (!filename.endsWith('.bt')) {
        filename = `${__dirname}/../std/${filename}.bt`
      }
      const varname = v(path.basename(filename, '.bt'));
      await this.compile(textDecoder.decode(await Deno.readFile(filename)));
      this.#imports[varname] = this.prefix-1;
      return
    }

    if (args[1] === "if" || args[1] === "while") {
      this.#wc += Number(args[0]);

      const jump = this.#linenumber + 1;

      const varname = this.compileExpression(args.slice(2).join(' '), prefix);

      const command = ['0', 'JMPNZ', null, varname]

      this.pushState(command)

      this.#stack.push({
        type: args[1],
        stuff: [],
        jump,
        command
      })

      return
    }

    if (args[1] === "func") {
      this.#stack.push({
        type: 'func',
        stuff: [],
        name: args[2],
        args: args.slice(3).map(item => v(item, args[2])),
        asString: code
      });
      return
    }
    
    if (this.#stack.length) {
      if (args[1] === "end") {
        this.#wc += Number(args[0]);

        const obj = this.#stack.pop();

        if (obj.type === 'func') {
          const {name: f, stuff, args: a, asString} = obj;

          this.pushState(['0', 'JMPREL', String(stuff.length + 2)]);

          const ind =  this.#linenumber + 1;

          for (const item of stuff) this.pushState(item);

          this.pushState(['0', 'JMPABS', `$JB_${f}`])

          this.#functions[f] = {
            ind,
            args: a,
            asString
          }

          return;
        } else if (obj.type === 'if' || obj.type === 'while') {
          const {stuff, command, jump} = obj;

          command[2] = String(this.#linenumber + 1 + (obj.type === 'while' ? 1 : 0));

          for (const item of stuff) this.pushState(item);

          if (obj.type === 'while') {
            this.pushState(["0", "JMPABS", String(jump)])
          }

          return
        }
      }
    }

    args[1] = `${args[1][0].toUpperCase()}${args[1].slice(1)}`;

    this.pushState(args)
  }
  
  to(file) {
    if (this.#wc) {
      this.wait(String(this.#wc));
      this.#wc = 0;
    }

    const state = this.#state;
    
    return Deno.writeFile(file, (new TextEncoder('utf-8')).encode((state=>{
      let max = 0;
      for (const item of state) {
        max = Math.max(item.length, max)
      }
      let content = '';
      for (const item of state) {
        content += item.map(thing => {
          if (typeof thing === 'string' && (thing.includes('\n') || thing.includes(',') || thing.includes('"'))) return `"${thing}"`;
          return thing 
        }).join(',')+(','.repeat(max-item.length))+'\n'
      }
      return content
    })(state)))
  }
  static async from(file, debug=false) {
    const textDecoder = new TextDecoder('utf-8');

    const obj = new BT(debug);

    await obj.compile(textDecoder.decode(await Deno.readFile(file)));

    return obj
  }
  compileExpression(node, prefix) {
    if (typeof node === 'string') {
      node = parseExp.parse(node)
    }
    if (node.literal) {
      if (node.literal.startsWith("$") && this.#functions[node.literal.slice(1)]) {
        return this.#functions[node.literal.slice(1)].asString
      }
      return node.literal
    }
    const varname = `MATH_${this.prefix++}`;

    if ('+-/*%'.includes(node.operator)) {
      this.pushState(['0', node.operator === '+' ? 'ADD': node.operator === '-' ? 'SUB' : node.operator === '*' ? 'MUL': node.operator === '/' ? 'DIV': node.operator === '%' ? 'MOD': '???', varname, this.compileExpression(node.first, prefix), this.compileExpression(node.second, prefix)])
    } else if (['<=', '==', '!=', '>=', '<', '>'].includes(node.operator)) {
      const jump = this.#linenumber + 3;
      let command;
      const op = node.operator;
      if (op === '==') {
        command = ['JMPE', null, this.compileExpression(node.first, prefix), this.compileExpression(node.second, prefix)]
      } else if (op == '!=') {
        command = ['JMPNE', null, this.compileExpression(node.first, prefix), this.compileExpression(node.second, prefix)]
      } else if (op == '<') {
        command = ['JMPL', null, this.compileExpression(node.first, prefix), this.compileExpression(node.second, prefix)]
      } else if (op == '>=') {
        command = ['JMPNL', null, this.compileExpression(node.first, prefix), this.compileExpression(node.second, prefix)]
      } else if (op == '>') {
        command = ['JMPG', null, this.compileExpression(node.first, prefix), this.compileExpression(node.second, prefix)]
      } else if (op == '<=') {
        command = ['JMPNG', null, this.compileExpression(node.first, prefix), this.compileExpression(node.second, prefix)]
      }
      command[1] = jump;
      this.pushState(['0', ...command]);
      this.pushState(['0', "SET", varname, "1"]);
      this.pushState(['0', "JMPREL", "2"]);
      this.pushState(['0', 'SET', varname, "0"]);
    } else if (node.call) {
      let varname = this.get(node.call.slice(1), prefix);
      this.#wc += Number(args[0]);
      const a = node.args.map(arg => this.compileExpression(arg));

      if (varname.includes('.')) {
        const [i, vn] = varname.split('.');

        varname = `${this.#imports[i]}_${vn}`
      }

      for (let i = 0; i < Math.min(this.#functions[varname].args.length, a.length); i++) {
        this.pushState(['0', 'SET', this.#functions[varname].args[i], a[i]])
      }

      this.pushState(['0', 'SET', `JB_${varname}`, String( this.#linenumber + 3)]);
      this.pushState(['0', 'JMPABS', this.#functions[varname].ind]);
      return 0
    }

    return `$${varname}`
  }
}

export default BT;