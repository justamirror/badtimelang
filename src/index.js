import lang from "./lang.js";
import { parse } from "https://deno.land/std@0.194.0/flags/mod.ts";
import { readline } from "https://deno.land/x/readline@v1.1.0/mod.ts";
const args = parse(Deno.args, {
    boolean: ["compile", "rcl", "debug", "help"],
    string: ["to"]
})

if (args.rcl) {
    let inst;
    console.log("Type 'exit' to exit.\n");
    if (args._[0] !== undefined) {
        inst = await lang.from(args._[0], args.debug);
    } else {
        inst = new lang(args.debug);
    }

    const prefix = inst.prefix-1;

    const clear = new TextEncoder().encode(`\x1b[A\r\x1b[2K`);

    for await (const line of readline(Deno.stdin)) {
        const decoded = new TextDecoder().decode(line);
        if (args.debug) await Deno.stdout.write(clear);
        if (decoded.trim().toLowerCase() === 'exit') {
            break;
        }
        await inst.compile(decoded, prefix);
    }

    await inst.to(args.to || (args._[0] === void 0 ? 'output.csv' : (args._[0].split('.').slice(0, -1).concat(['csv']).join('.'))))
} else if (args.compile) {
    const inst = await lang.from(args._[0], args.debug);

    await inst.to(args.to || (args._[0].split('.').slice(0, -1).concat(['csv']).join('.')))
} else if (args.help) {
    console.log(`badtime --help: This!
badtime [file] --rcl [--debug]: Activate input prompt, with an optional file to run.
badtime file --compile [--debug]: Compile a file.

--debug: Debug mode prints out compiled statements.`)
} else {
    console.log('No options supplied. Use badtime --help to view help')
}