#!/usr/bin/env node
/* -*- tab-width: 2; indent-tabs-mode: t -*- */

/**
	Executable JSON
	@module
*/

const fs = require ('fs');
const {JSONFunction} = require ('../index.js');

const func = new JSONFunction (fs.readFileSync (0, 'utf-8'));

const result = func (process.argv.slice (1), process.env);
process.stdout.write (JSON.stringify (result), 'utf-8');

