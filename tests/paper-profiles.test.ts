import { buildPaperFamilies } from '@pages/Generator/config/paperFamilies';
import {
  PAPER_PROFILES_VERSION,
  parsePaperProfiles,
} from '@pages/Generator/model/paperProfiles';
import { describe, expect, it } from 'vitest';

/**
 * Экземпляр в том виде, в каком его пишет скрипт сборки: карта текстуры —
 * путь к файлу рядом с фотографией, а не data URL.
 */
const buildProfile = (id: string) => {
  return {
    id,
    label: `Клетка ${id}`,
    src: `/paper/grid/${id}.jpg`,
    width: 1600,
    height: 2050,
    skewAngle: -0.8,
    normalizeScale: 1.04,
    firstLinePhase: 96.5,
    lighting: {
      gridWidth: 2,
      gridHeight: 1,
      values: [1, 0.8],
      contrast: 0.2,
      isUsable: true,
    },
    texture: {
      src: '/paper/grid/1.texture.png',
      width: 256,
      height: 320,
      amplitude: 0.05,
    },
  };
};

const buildArtifact = (version: number = PAPER_PROFILES_VERSION) => {
  return { version, families: { grid: [buildProfile('1')] } };
};

describe('разбор артефакта профилей', () => {
  it('берёт характеристики экземпляров как есть', () => {
    const profiles = parsePaperProfiles(buildArtifact());

    expect(profiles.grid?.[0]?.skewAngle).toBe(-0.8);
    expect(profiles.grid?.[0]?.normalizeScale).toBe(1.04);
    expect(profiles.grid?.[0]?.firstLinePhase).toBe(96.5);
  });

  it('принимает карту текстуры, заданную путём к файлу', () => {
    const profiles = parsePaperProfiles(buildArtifact());

    expect(profiles.grid?.[0]?.texture?.src).toBe('/paper/grid/1.texture.png');
    expect(profiles.grid?.[0]?.lighting?.isUsable).toBe(true);
  });

  it('отбрасывает артефакт чужой версии целиком', () => {
    expect(parsePaperProfiles(buildArtifact(PAPER_PROFILES_VERSION + 1))).toEqual({});
  });

  it('отбрасывает экземпляр без фотографии, оставляя остальные', () => {
    const profiles = parsePaperProfiles({
      version: PAPER_PROFILES_VERSION,
      families: { grid: [{ id: 'broken' }, buildProfile('1')] },
    });

    expect(
      profiles.grid?.map((sheet) => {
        return sheet.id;
      })
    ).toEqual(['1']);
  });
});

describe('сборка предустановленных семей', () => {
  it('подставляет посчитанные экземпляры в свою семью', () => {
    const [grid, lined] = buildPaperFamilies(parsePaperProfiles(buildArtifact()));

    expect(grid?.sheets).toHaveLength(1);
    expect(grid?.sheets[0]?.id).toBe('1');
    expect(lined?.sheets).toHaveLength(4);
  });

  it('оставляет канон семьи из констант, а не из артефакта', () => {
    const [gridWithProfiles] = buildPaperFamilies(parsePaperProfiles(buildArtifact()));
    const [gridPlain] = buildPaperFamilies({});

    expect(gridWithProfiles?.ruling).toEqual(gridPlain?.ruling);
    expect(gridWithProfiles?.width).toBe(gridPlain?.width);
  });

  it('без артефакта отдаёт обе семьи с экземплярами без измерений', () => {
    const families = buildPaperFamilies({});

    expect(
      families.map((family) => {
        return family.id;
      })
    ).toEqual(['grid', 'lined']);
    /**
     * Измерений нет: экземпляр берёт нормировку, при которой фотография
     * закрывает канонический лист целиком, а шаг разлиновки в пикселях
     * фотографии выводится из той же нормировки — иначе разлиновка
     * фотографии не села бы на канон семьи.
     */
    const sheet = families[0]?.sheets[0];

    expect((sheet?.measuredStep || 0) * (sheet?.normalizeScale || 0)).toBeCloseTo(
      families[0]?.ruling.step || 0,
      9
    );
    expect(sheet?.lighting).toBeNull();
  });
});
