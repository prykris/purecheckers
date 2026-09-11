// All stationary, moving, dragged and captured pieces use the same painter.
export function drawCanvasPiece(ctx, CELL, skin, px, py, color, isQueen, alpha = 1, scale = 1) {
    const palette = skin[color];
    const r = CELL * 0.38;
    ctx.save();
    ctx.translate(px, py); ctx.scale(scale, scale); ctx.translate(-px, -py);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.ellipse(px + 1, py + 3, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py + 2, r, 0, Math.PI * 2); ctx.fillStyle = palette.base; ctx.fill();
    const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    palette.gradStops.forEach((stop, index) => g.addColorStop([0, 0.7, 1][index], stop));
    if (palette.glow) { ctx.shadowColor = palette.base; ctx.shadowBlur = CELL * 0.14; }
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = palette.stroke; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, r * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = palette.ring; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(px - r * 0.15, py - r * 0.2, r * 0.3, r * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = palette.highlight; ctx.fill();
    ctx.shadowBlur = 0;
    if (isQueen) {
      const cw = r * 0.55, ch = r * 0.35, cy = py - ch * 0.1;
      ctx.beginPath(); ctx.moveTo(px - cw, cy + ch * 0.4); ctx.lineTo(px - cw, cy - ch * 0.3); ctx.lineTo(px - cw * 0.5, cy + ch * 0.1);
      ctx.lineTo(px, cy - ch * 0.5); ctx.lineTo(px + cw * 0.5, cy + ch * 0.1); ctx.lineTo(px + cw, cy - ch * 0.3); ctx.lineTo(px + cw, cy + ch * 0.4); ctx.closePath();
      const cg = ctx.createLinearGradient(px, cy - ch * 0.5, px, cy + ch * 0.4);
      cg.addColorStop(0, '#ffe066'); cg.addColorStop(1, '#b8860b');
      ctx.fillStyle = cg; ctx.fill(); ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 0.5; ctx.stroke();
    }
    ctx.restore();
  }
