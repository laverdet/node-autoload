autoload -- Automatically load symbols in NodeJS
================================================

INTRODUCTION
------------

In NodeJS, and CommonJS in general, it's difficult to depend on common globals to be defined when
you need them. This has led to very chatty or verbose boilerplate in applications to grab handles
to functions and objects in every module in a project.

Generally module exports are used to define pseudo-classes or pseudo-namespaces which make sense as
as globals. The problem is that even if your module defines its exports as global there's no way to
be sure the module you depend on has been required or not. `autoload` attempts to ease this
situation.


INSTALLING
----------

		npm install autoload


GETTING STARTED
---------------

In your top-level script, call `autoload` and `registeredGlobalsAutoloader` to initialize a typical
autoloading environment:

		main.js:
		var autoload = require('autoload');
		autoload.autoload(__dirname, [autoload.registeredGlobalsAutoloader(require)], function() {
			<< your regular code goes here >>
		});
		<< don't put code here, as autoload is not ready yet! >>


To register a global as autoloadable, in another module you would do:

		my-global-function.js:
		registerGlobal(function MyGlobalFunction() {
			<< function here >>
		});


When you call `autoload` it will search `__dirname` for Javascript files and attempt to find all
globals which could be defined (via `registerGlobal`). After it finds those symbols it registers
autoloading getters on the global object (but does not actually require the module). When the getter
is invoked the module is require'd and the symbol is returned.

Be sure to look at the source code for `registeredGlobalsAutoloader`, as you can use this library to
autoload symbols in scopes outside of global as well, or you can implement your own global exporting
pattern too. For instance of you prefer `global.MySymbol = ...` or `MySymbol = ...` you could wire
that up. I prefer having the global be super explicit which is why I made registerGlobal().
