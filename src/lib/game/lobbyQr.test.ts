import { describe, expect, it } from 'vitest';
import {
  QR_COURT,
  QR_INK,
  QR_SIGNAL,
  QR_VIOLET,
  buildLobbyQrModel,
  finderCorner,
  finderFill,
  isInLogoHole,
  logoHoleSize,
  moduleFill,
} from '@/lib/game/lobbyQr';

const SAMPLE = 'https://qlash.test/play?pin=847291';

describe('lobbyQr', () => {
  it('colors the three finder corners in the arena palette', () => {
    expect(finderCorner(0, 0, 29)).toBe('tl');
    expect(finderCorner(0, 22, 29)).toBe('tr');
    expect(finderCorner(22, 0, 29)).toBe('bl');
    expect(finderCorner(14, 14, 29)).toBeNull();
    expect(finderFill('tl')).toBe(QR_SIGNAL);
    expect(finderFill('tr')).toBe(QR_COURT);
    expect(finderFill('bl')).toBe(QR_VIOLET);
    expect(moduleFill(10, 10, 29)).toBe(QR_INK);
  });

  it('keeps a centered hole so the Qlash mark can sit on the code', () => {
    expect(logoHoleSize(29)).toBe(7);
    expect(isInLogoHole(14, 14, 29)).toBe(true);
    expect(isInLogoHole(0, 0, 29)).toBe(false);
  });

  it('builds a high-correction model with themed modules and a logo slot', () => {
    const model = buildLobbyQrModel(SAMPLE);
    expect(model).not.toBeNull();
    if (!model) return;
    expect(model.size).toBeGreaterThanOrEqual(21);
    expect(model.modules.length).toBeGreaterThan(40);
    expect(model.finders.map((finder) => finder.corner)).toEqual(['tl', 'tr', 'bl']);
    expect(model.finders.map((finder) => finder.fill)).toEqual([QR_SIGNAL, QR_COURT, QR_VIOLET]);
    expect(model.modules.every((cell) => cell.fill === QR_INK)).toBe(true);
    expect(model.modules.every((cell) => !finderCorner(cell.row, cell.col, model.size))).toBe(true);
    expect(model.modules.every((cell) => !isInLogoHole(cell.row, cell.col, model.size))).toBe(true);
    expect(model.logo.size).toBeGreaterThan(2);
  });

  it('returns null for an empty value', () => {
    expect(buildLobbyQrModel('')).toBeNull();
  });
});
