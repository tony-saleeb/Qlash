import QRCode from 'qrcode';

export const QR_INK = '#0a0c10';
export const QR_SIGNAL = '#e11d2e';
export const QR_COURT = '#0a6b5c';
export const QR_VIOLET = '#4a2aff';
export const QR_LIGHT = '#ffffff';
export const QR_ACID = '#c8f542';

export type FinderCorner = 'tl' | 'tr' | 'bl';

export type LobbyQrModule = {
  row: number;
  col: number;
  fill: string;
};

export type LobbyQrFinder = {
  corner: FinderCorner;
  row: number;
  col: number;
  fill: string;
};

export type LobbyQrModel = {
  size: number;
  margin: number;
  viewBox: number;
  modules: LobbyQrModule[];
  finders: LobbyQrFinder[];
  logo: { x: number; y: number; size: number; pad: number };
};

const FINDER = 7;
const MARGIN = 2;

export function isInFinder(row: number, col: number, top: number, left: number): boolean {
  return row >= top && row < top + FINDER && col >= left && col < left + FINDER;
}

export function finderCorner(row: number, col: number, size: number): FinderCorner | null {
  if (isInFinder(row, col, 0, 0)) return 'tl';
  if (isInFinder(row, col, 0, size - FINDER)) return 'tr';
  if (isInFinder(row, col, size - FINDER, 0)) return 'bl';
  return null;
}

export function finderFill(corner: FinderCorner): string {
  if (corner === 'tl') return QR_SIGNAL;
  if (corner === 'tr') return QR_COURT;
  return QR_VIOLET;
}

export function logoHoleSize(size: number): number {
  const raw = size >= 29 ? 7 : 5;
  return raw % 2 === size % 2 ? raw : raw + 1;
}

export function isInLogoHole(row: number, col: number, size: number): boolean {
  const hole = logoHoleSize(size);
  const start = Math.floor((size - hole) / 2);
  return row >= start && row < start + hole && col >= start && col < start + hole;
}

export function moduleFill(row: number, col: number, size: number): string {
  const corner = finderCorner(row, col, size);
  if (corner) return finderFill(corner);
  return QR_INK;
}

export function buildLobbyQrModel(value: string): LobbyQrModel | null {
  if (!value) return null;
  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const matrix = qr.modules;
    const size = matrix.size;
    const modules: LobbyQrModule[] = [];
    const finders: LobbyQrFinder[] = [
      { corner: 'tl', row: 0, col: 0, fill: finderFill('tl') },
      { corner: 'tr', row: 0, col: size - FINDER, fill: finderFill('tr') },
      { corner: 'bl', row: size - FINDER, col: 0, fill: finderFill('bl') },
    ];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!matrix.get(row, col) || isInLogoHole(row, col, size) || finderCorner(row, col, size)) continue;
        modules.push({ row, col, fill: QR_INK });
      }
    }

    const hole = logoHoleSize(size);
    const holeStart = Math.floor((size - hole) / 2);
    const pad = 0.45;
    const logoSize = hole - pad * 2;

    return {
      size,
      margin: MARGIN,
      viewBox: size + MARGIN * 2,
      modules,
      finders,
      logo: {
        x: MARGIN + holeStart + pad,
        y: MARGIN + holeStart + pad,
        size: logoSize,
        pad,
      },
    };
  } catch {
    return null;
  }
}
