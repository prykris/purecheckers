export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19')
];

export const server_loads = [];

export const dictionary = {
		"/(marketing)": [15,[3]],
		"/(app)/auth": [4,[2]],
		"/(marketing)/blog": [16,[3]],
		"/(marketing)/changelog": [17,[3]],
		"/(marketing)/es": [18,[3]],
		"/(app)/friends": [5,[2]],
		"/(app)/game": [6,[2]],
		"/(app)/join/[code]": [7,[2]],
		"/(app)/lobby": [8,[2]],
		"/(app)/profile": [9,[2]],
		"/(app)/room-waiting": [10,[2]],
		"/(app)/search": [11,[2]],
		"/(app)/shop": [12,[2]],
		"/(marketing)/strategy": [19,[3]],
		"/(app)/treasury": [13,[2]],
		"/(app)/wheel": [14,[2]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';