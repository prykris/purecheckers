<script>
  export let name;
  export let size = 20;
  const paths = {
    more: 'M12 5h.01M12 12h.01M12 19h.01',
    copy: 'M9 9h12v12H9ZM15 9V3H3v12h6',
    expand:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5', collapse:'M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5',
    first:'M5 5v14m13-14-9 7 9 7Z', last:'M19 5v14M6 5l9 7-9 7Z', previous:'m15 5-7 7 7 7', play:'m7 4 13 8-13 8Z', pause:'M8 4v16M16 4v16', share:'M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
    chat: 'M20 11a8 8 0 0 1-8 8H4l-2 3V11a9 9 0 0 1 18 0Z',
    smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 14c2 3 6 3 8 0M8 9h.01M16 9h.01',
    draw: 'M5 8h14M5 16h14', flag: 'M5 22V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0',
    close: 'm6 6 12 12M6 18 18 6', down: 'm6 9 6 6 6-6', up: 'm6 15 6-6 6 6',
    star: 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
    check: 'm5 12 4 4L19 6', question: 'M8 7a4 4 0 0 1 8 0c0 3-4 3-4 6m0 5v.1',
    sound: 'm11 4-6 5H2v6h3l6 5ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
    eyeOff: 'm3 3 18 18M10 5q1-.2 2-.2c7 0 10 7 10 7a21 21 0 0 1-4 5M6 6a23 23 0 0 0-4 6s4 7 10 7q2 0 4-1M10 10a3 3 0 0 0 4 4',
    history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2',
    arrow: 'm8 4 8 8-8 8', send: 'm3 3 19 9-19 9 4-9Zm4 9h15',
    crown: 'm3 7 4 4 5-7 5 7 4-4-2 12H5Z', reset: 'M3 11a9 9 0 1 1 2 7M3 4v7h7'
  };
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name] || paths.question} /></svg>
