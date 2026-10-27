import { describe, expect, it } from 'vitest'
import { inspectPreferencesLayout } from '../scripts/lib/preferences-layout.mjs'

type Rect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

type FixtureRow = {
  title?: string
  row: Rect
  label?: Rect
  control?: Rect
}

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
})

const validRows = (): FixtureRow[] => [
  { title: '昵称', row: rect(18, 100, 372, 190), label: rect(34, 108, 340, 150), control: rect(34, 158, 356, 188) },
  { title: '个人签名', row: rect(18, 190, 372, 310), label: rect(34, 198, 340, 245), control: rect(34, 252, 356, 300) },
  { title: '所在地', row: rect(18, 310, 372, 390), label: rect(34, 318, 340, 350), control: rect(34, 358, 356, 388) },
  { title: '个人网站', row: rect(18, 390, 372, 470), label: rect(34, 398, 340, 430), control: rect(34, 438, 356, 468) },
]

function inspect(rows: FixtureRow[], viewportWidth = 390, scrollWidth = viewportWidth) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const widthDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth')
  try {
    Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: viewportWidth })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
      documentElement: { scrollWidth },
      querySelectorAll: () => rows.map(({ title, row, label, control }) => ({
        querySelector: (selector: string) => {
          if (selector === '.tx-block-slot__title')
            return title === undefined ? null : { textContent: title }
          if (selector === '.tx-block-slot__label')
            return label === undefined ? null : { getBoundingClientRect: () => label }
          if (selector === 'input, textarea')
            return control === undefined ? null : { getBoundingClientRect: () => control }
          return null
        },
        getBoundingClientRect: () => row,
      })),
    } as unknown as Document })
    return inspectPreferencesLayout()
  }
  finally {
    if (documentDescriptor)
      Object.defineProperty(globalThis, 'document', documentDescriptor)
    else
      Reflect.deleteProperty(globalThis, 'document')
    if (widthDescriptor)
      Object.defineProperty(globalThis, 'innerWidth', widthDescriptor)
    else
      Reflect.deleteProperty(globalThis, 'innerWidth')
  }
}

describe('preferences layout geometry helper', () => {
  it('accepts the four complete label/control pairs inside separate rows', () => {
    const result = inspect(validRows())

    expect(result.valid).toBe(true)
    expect(result.rows).toHaveLength(4)
    expect(result.measurements).toHaveLength(8)
    expect(result.errors).toEqual([])
  })

  it('accepts the demo label for the same website field', () => {
    const rows = validRows()
    rows[3]!.title = '网站'

    const result = inspect(rows)

    expect(result.valid).toBe(true)
    expect(result.rows).toHaveLength(4)
    expect(result.measurements).toHaveLength(8)
  })

  it('rejects a real overlap between fields', () => {
    const rows = validRows()
    rows[2]!.label = rect(34, 292, 340, 330)

    const result = inspect(rows)

    expect(result.valid).toBe(false)
    expect(result.overlaps).toContainEqual(expect.objectContaining({
      first: '个人签名:control',
      second: '所在地:label',
    }))
  })

  it('rejects viewport overflow even when the page scroll width is unchanged', () => {
    const rows = validRows()
    rows[3]!.control = rect(34, 438, 402, 468)

    const result = inspect(rows)

    expect(result.valid).toBe(false)
    expect(result.clipped).toContainEqual({ title: '个人网站', kind: 'control' })
  })

  it('rejects horizontal page overflow even when every measured box fits', () => {
    const result = inspect(validRows(), 390, 420)

    expect(result.valid).toBe(false)
    expect(result.pageOverflow).toBe(true)
    expect(result.clipped).toEqual([])
  })

  it('rejects a label or control escaping its own row', () => {
    const rows = validRows()
    rows[1]!.control = rect(12, 252, 380, 320)

    const result = inspect(rows)

    expect(result.valid).toBe(false)
    expect(result.escaped).toContainEqual({ title: '个人签名', kind: 'control' })
  })

  it.each([
    ['label', { label: undefined }],
    ['control', { control: undefined }],
  ] as const)('rejects a row with no %s', (kind, replacement) => {
    const rows = validRows()
    rows[0] = { ...rows[0]!, ...replacement }

    const result = inspect(rows)

    expect(result.valid).toBe(false)
    expect(result.missing).toContainEqual({ index: 0, title: '昵称', kind })
  })

  it.each([
    ['zero-sized', rect(34, 158, 34, 188), 'non-positive size'],
    ['non-finite', { ...rect(34, 158, 356, 188), width: Number.NaN }, 'non-finite'],
  ])('rejects a %s rectangle', (_name, broken, reason) => {
    const rows = validRows()
    rows[0]!.control = broken

    const result = inspect(rows)

    expect(result.valid).toBe(false)
    expect(result.invalid).toContainEqual({ index: 0, title: '昵称', kind: 'control', reason })
  })

  it('rejects zero measured rows', () => {
    const result = inspect([])

    expect(result.valid).toBe(false)
    expect(result.missingFields).toEqual(['昵称', '个人签名', '所在地', '个人网站'])
    expect(result.measurements).toEqual([])
  })

  it('rejects a missing expected field even when three rows are valid', () => {
    const result = inspect(validRows().filter(row => row.title !== '所在地'))

    expect(result.valid).toBe(false)
    expect(result.missingFields).toEqual(['所在地'])
    expect(result.rows).toHaveLength(3)
    expect(result.measurements).toHaveLength(6)
  })
})
