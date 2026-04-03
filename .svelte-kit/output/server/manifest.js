export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.BQDLVJvx.js",app:"_app/immutable/entry/app.CXkiWkNw.js",imports:["_app/immutable/entry/start.BQDLVJvx.js","_app/immutable/chunks/DWu77KBa.js","_app/immutable/chunks/DY8dxpqC.js","_app/immutable/chunks/B5BBNWzi.js","_app/immutable/entry/app.CXkiWkNw.js","_app/immutable/chunks/DY8dxpqC.js","_app/immutable/chunks/C9QTIKFY.js","_app/immutable/chunks/Dd4wZ4Na.js","_app/immutable/chunks/B5BBNWzi.js","_app/immutable/chunks/PMzZc74c.js","_app/immutable/chunks/D4wgf1HQ.js","_app/immutable/chunks/CfZSWuz2.js","_app/immutable/chunks/CzWFdUD0.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/(app)/auth",
				pattern: /^\/auth\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/(app)/friends",
				pattern: /^\/friends\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/(app)/game",
				pattern: /^\/game\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/(app)/join/[code]",
				pattern: /^\/join\/([^/]+?)\/?$/,
				params: [{"name":"code","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/(app)/lobby",
				pattern: /^\/lobby\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/(app)/profile",
				pattern: /^\/profile\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/(app)/room-waiting",
				pattern: /^\/room-waiting\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/(app)/search",
				pattern: /^\/search\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/(app)/shop",
				pattern: /^\/shop\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/(app)/treasury",
				pattern: /^\/treasury\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/(app)/wheel",
				pattern: /^\/wheel\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 13 },
				endpoint: null
			}
		],
		prerendered_routes: new Set(["/","/blog","/changelog","/es","/strategy"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
