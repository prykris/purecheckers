
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/(marketing)" | "/(app)" | "/" | "/(app)/auth" | "/(marketing)/blog" | "/(marketing)/changelog" | "/(marketing)/es" | "/(app)/friends" | "/(app)/game" | "/(app)/join" | "/(app)/join/[code]" | "/(app)/lobby" | "/(app)/profile" | "/(app)/room-waiting" | "/(app)/search" | "/(app)/shop" | "/(marketing)/strategy" | "/(app)/treasury" | "/(app)/wheel";
		RouteParams(): {
			"/(app)/join/[code]": { code: string }
		};
		LayoutParams(): {
			"/(marketing)": Record<string, never>;
			"/(app)": { code?: string };
			"/": { code?: string };
			"/(app)/auth": Record<string, never>;
			"/(marketing)/blog": Record<string, never>;
			"/(marketing)/changelog": Record<string, never>;
			"/(marketing)/es": Record<string, never>;
			"/(app)/friends": Record<string, never>;
			"/(app)/game": Record<string, never>;
			"/(app)/join": { code?: string };
			"/(app)/join/[code]": { code: string };
			"/(app)/lobby": Record<string, never>;
			"/(app)/profile": Record<string, never>;
			"/(app)/room-waiting": Record<string, never>;
			"/(app)/search": Record<string, never>;
			"/(app)/shop": Record<string, never>;
			"/(marketing)/strategy": Record<string, never>;
			"/(app)/treasury": Record<string, never>;
			"/(app)/wheel": Record<string, never>
		};
		Pathname(): "/" | "/auth" | "/blog" | "/changelog" | "/es" | "/friends" | "/game" | `/join/${string}` & {} | "/lobby" | "/profile" | "/room-waiting" | "/search" | "/shop" | "/strategy" | "/treasury" | "/wheel";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | string & {};
	}
}