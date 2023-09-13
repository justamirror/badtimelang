# Badtime Lang

## The heck is this? [What is this?]

Badtime Lang is a programming language that compiles to `.csv` files for the
[Bad Time Simulator](http://jcw87.github.io/c2-sans-fight/) website.

Why though?

* Editing Excel spreadsheets ***sucks***.
* More control structures than the bare `.csv` file.
* Doesn’t use `PascalCase`, instead uses `camelCase`.
* Expression evaluator (math stuff like `10 + 20 + 30`) without using the math
  commands.
* You can also use math functions (`$sin`, `$floor`, `$angle`, etc).

## Ok, but how do I *use* it? \[Install and Getting Started\]

To install badtimelang, you need deno installed. To do that, check [Installation | Manual | Deno](https://deno.land/manual@v1.36.4/getting_started/installation). Finally you can use (assuming you are in the install directory) `deno install https://deno.land/x/badtime/src/index.js -n badtime --allow-all`.

To compile a file, use `badtime --compile file.bt`.

Check [further documentation](docs/README.md) for more details.

## TODO

* Public variables
* Public / Private distinction (export keyword, maybe)
* Modules folder
* Objects and Arrays
* Classes (maybe prototyped?)