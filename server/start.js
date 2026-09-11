// Set the production mode before importing configuration or the HTTP server.
// A JS entry point works on Windows and Unix without shell-specific assignment.
process.env.NODE_ENV = 'production';
await import('./index.js');
