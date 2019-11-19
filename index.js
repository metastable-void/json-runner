/* -*- tab-width: 2; indent-tabs-mode: t -*- */

/**
	Executable JSON
	@module
*/

// zero dependency

const propertiesMap = new WeakMap;

const clone = obj => JSON.parse (JSON.stringify (obj));

const normalizeSymbol = symbol => {
	if ('number' == typeof symbol) {
		symbol = String (symbol);
	}
	
	return symbol;
};

const normalizedMap = new WeakMap;
const normalizeNode = node => {
	if (normalizedMap.has (node)) {
		return normalizedMap.get (node);
	}
	
	if (Array.isArray (node)) {
		const objectified = Object.assign (Object.create (null), node);
		normalizedMap.set (node, objectified);
		return objectified;
	}
	
	return node;
};

const getPositionalArgs = context => {
	const ownKeys = Reflect.ownKeys (context);
	const args = [];
	for (let i = 1; ownKeys.includes (String (i)); i++) {
		args.push (context[String (i)]);
	}
	return args;
};

const global = {
	"$": function (context) {
		const args = getPositionalArgs (context);
		const origScope = 'undefined' == typeof args[1] ? null : args[1];
		
		const symbol = normalizeSymbol ('undefined' == typeof args[0] ? null : args[0]);
		if ('object' == typeof symbol || null === symbol) {
			return symbol;
		}
		
		const scope = origScope !== null && 'object' == typeof origScope ? origScope : this;
		
		if ("0" === symbol) {
			return scope;
		}
		
		return symbol in scope ? ('undefined' == typeof scope[symbol] ? null : scope[symbol]) : null;
	},
	
	"+": function (context) {
		const args = getPositionalArgs (context);
		if (args.filter (item => 'string' == typeof item).length == args.length) {
			return args.join ('');
		} else if (args.filter (item => 'number' == typeof item).length == args.length) {
			return args.reduce ((sum, x) => sum + x, 0);
		} else {
			return null;
		}
	},
	
	"*": function (context) {
		const args = getPositionalArgs (context);
		if (args.filter (item => 'number' == typeof item).length == args.length) {
			return args.reduce ((result, x) => result * x, 1);
		} else {
			return null;
		}
	},
	
	"-": function (context) {
		const [x] = getPositionalArgs (context);
		return 'number' == typeof x ? - x : null;
	},
	
	"/": function (context) {
		const [x] = getPositionalArgs (context);
		return 'number' == typeof x ? 1 / x : null;
	},
	
	"=": function (context) {
		const args = getPositionalArgs (context);
		return 1 == new Set (args).size;
	},
	
	"?": function (context) {
		const [cond, trueValue, falseValue] = getPositionalArgs (context);
		return '' === cond || false === cond || null === cond || 0 === cond || -0 === cond
			? falseValue : trueValue;
	},
	
	",": function (context) {
		const args = getPositionalArgs (context);
		return [, ... args];
	},
};
Reflect.setPrototypeOf (global, null);

/**
	Static evaluation.
*/
const evalNode = (node, parent) => {
	if (null === node || 'object' != typeof node) {
		return node;
	}
	
	node = normalizeNode (node);
	Reflect.setPrototypeOf (node, parent || global);
	
	const ownKeys = Reflect.ownKeys (node);
	
	const isEvaluation = ownKeys.includes ("0");
	if (!isEvaluation) {
		return node;
	}
	
	const context = Object.create (parent || global);
	ownKeys.forEach (key => {
		context[key] = evalNode (node[key], context);
	});
	
	const callee = context["$"] ({"1": context["0"]});
	if ('function' == typeof callee) {
		// builtin
		const result = callee.call (parent || global, context);
		return 'undefined' == typeof result ? null : result;
	} else if (null === callee || 'object' != typeof callee) {
		return callee;
	}
	
	const calleePrototype = Reflect.getPrototypeOf (callee);
	
	const calleeOwnKeys = Reflect.ownKeys (callee);
	const calleeContext = Object.create (Object.assign (Object.create (calleePrototype), context));
	
	calleeOwnKeys.forEach (key => {
		calleeContext[key] = evalNode (callee[key], calleeContext);
	});
	
	if (Reflect.ownKeys (calleeContext).includes ('<-')) {
		return calleeContext['<-'];
	}
	
	return calleeContext;
};

class JSONFunction extends Function {
	constructor (json) {
		const properties = Object.create (null);
		properties.root = JSON.parse (json);
		
		const func = function func (... argumentsList) {
			return func.call (this, ... argumentsList);
		};
		
		Reflect.setPrototypeOf (func, JSONFunction.prototype);
		
		propertiesMap.set (func, properties);
		
		return func;
	}
	
	call (thisArg, ... argumentsList) {
		const properties = propertiesMap.get (this);
		const copiedArgs = JSON.parse (JSON.stringify (argumentsList), (key, value) => {
			if (!Array.isArray (value)) {
				return value;
			}
			
			return Object.assign (Object.create (null), [, ... value]);
		});
		
		return evalNode ({... copiedArgs, "0": properties.root});
	}
}

exports.JSONFunction = JSONFunction;

