import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url)),workspace=fileURLToPath(new URL('../../',import.meta.url));
const server=await createServer({configFile:false,root,publicDir:workspace+'src/static',plugins:[svelte({configFile:false})],resolve:{alias:{$lib:workspace+'src/lib'}},server:{host:'127.0.0.1',port:5182,strictPort:true,watch:{ignored:['**/touch-check-profile/**']},fs:{allow:[workspace]}}});
await server.listen();server.printUrls();
