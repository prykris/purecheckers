const es = {
  Keep: 'Conserva', games: 'partidas', wins: 'victorias', losses: 'derrotas', coins: 'monedas', Sound: 'Sonido', off: 'desactivado', on: 'activado',
  Home: 'Inicio', 'Log in': 'Iniciar sesión', 'Create account': 'Crear cuenta', 'Save account': 'Guardar cuenta',
  'Play as guest': 'Jugar como invitado', 'Pick a name and play': 'Elige un nombre y juega',
  'Welcome back': 'Bienvenido de nuevo', 'Create your account': 'Crea tu cuenta', Play: 'Jugar',
  Nickname: 'Apodo', Username: 'Nombre de usuario', Email: 'Correo electrónico', Password: 'Contraseña',
  'Starting…': 'Iniciando…', 'Signing in…': 'Iniciando sesión…', 'Creating account…': 'Creando cuenta…',
  'Forgot password?': '¿Olvidaste la contraseña?', 'Password recovery': 'Recuperar contraseña',
  'Back to log in': 'Volver a iniciar sesión', 'Your account': 'Tu cuenta', Close: 'Cerrar',
  'Profile & statistics': 'Perfil y estadísticas', 'Log out': 'Cerrar sesión', 'Return to game': 'Volver al juego',
  'Keep your name & game history': 'Conserva tu nombre e historial', Chat: 'Chat', Ranks: 'Clasificación',
  Treasury: 'Tesorería', Shop: 'Tienda', Friends: 'Amigos', Profile: 'Perfil',
  'Daily puzzle': 'Problema diario', Rules: 'Reglas', Guides: 'Guías', Changelog: 'Novedades',
  'Browse the site': 'Explorar el sitio', 'Quick Play': 'Partida rápida', Rooms: 'Salas', Bot: 'Bot',
  'Find Opponent': 'Buscar rival', 'Play Someone Nearby': 'Jugar con un amigo',
  'Play with a friend': 'Jugar con un amigo', 'Not now': 'Ahora no', Name: 'Nombre', 'Saving…': 'Guardando…',
  'Your name, your games and your rating stay with the account.': 'Tu nombre, partidas y puntuación se conservan en la cuenta.',
  'Save before logging out to keep access to this guest profile.': 'Guarda la cuenta antes de cerrar sesión para conservar este perfil de invitado.',
  'Email delivery is not connected yet, so password-reset emails are currently unavailable.': 'El envío de correo aún no está conectado, por lo que no se pueden enviar mensajes para restablecer contraseñas.',
  'Some game screens and guides are currently available only in English.': 'Algunas pantallas del juego y guías solo están disponibles en inglés por ahora.',
  'Save this guest profile before switching accounts if you want to keep its progress.': 'Guarda este perfil de invitado antes de cambiar de cuenta para conservar su progreso.'
};
export const siteText = (text, language = 'en') => language === 'es' ? es[text] ?? text : text;
