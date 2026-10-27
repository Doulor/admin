/** Run in the rendered page; shared by the CDP suite and isolated UI acceptance. */
export function inspectPreferencesLayout() {
  const expectedFieldTitles = [['昵称'], ['个人签名'], ['所在地'], ['个人网站', '网站']]
  const expectedFields = expectedFieldTitles.map(titles => titles[0])
  const rectOf = (element) => {
    const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
    return { left, top, right, bottom, width, height }
  }
  const rectProblem = (rect) => {
    if (![rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite))
      return 'non-finite'
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= rect.left || rect.bottom <= rect.top)
      return 'non-positive size'
    return null
  }
  const missing = []
  const invalid = []
  const rows = [...document.querySelectorAll('.preferences-panel .tx-block-input')].map((row, index) => {
    const control = row.querySelector('input, textarea')
    const label = row.querySelector('.tx-block-slot__label')
    const titleElement = row.querySelector('.tx-block-slot__title')
    const title = titleElement?.textContent?.trim() ?? ''
    const measured = {
      title,
      row: rectOf(row),
      label: label ? rectOf(label) : null,
      control: control ? rectOf(control) : null,
    }
    if (!title)
      missing.push({ index, title, kind: 'title' })
    if (!label)
      missing.push({ index, title, kind: 'label' })
    if (!control)
      missing.push({ index, title, kind: 'control' })
    for (const kind of ['row', 'label', 'control']) {
      if (!measured[kind])
        continue
      const reason = rectProblem(measured[kind])
      if (reason)
        invalid.push({ index, title, kind, reason })
    }
    return measured
  })
  const overlaps = []
  const escaped = []
  const clipped = []
  const measurements = rows.flatMap((row, index) => ['label', 'control']
    .filter(kind => row[kind] && !rectProblem(row[kind]))
    .map(kind => ({ index, kind, title: row.title, rect: row[kind] })))
  for (let i = 0; i < measurements.length; i++) {
    const box = measurements[i]
    const row = rows[box.index].row
    if (!rectProblem(row)
      && (box.rect.left < row.left - 1 || box.rect.top < row.top - 1
        || box.rect.right > row.right + 1 || box.rect.bottom > row.bottom + 1))
      escaped.push({ title: box.title, kind: box.kind })
    if (box.rect.left < -1 || box.rect.right > innerWidth + 1)
      clipped.push({ title: box.title, kind: box.kind })
    for (const other of measurements.slice(i + 1)) {
      const width = Math.min(box.rect.right, other.rect.right) - Math.max(box.rect.left, other.rect.left)
      const height = Math.min(box.rect.bottom, other.rect.bottom) - Math.max(box.rect.top, other.rect.top)
      if (width > 1 && height > 1)
        overlaps.push({ first: `${box.title}:${box.kind}`, second: `${other.title}:${other.kind}`, width, height })
    }
  }
  const titles = rows.map(row => row.title)
  const allExpectedTitles = expectedFieldTitles.flat()
  const missingFields = expectedFieldTitles
    .filter(options => !titles.some(title => options.includes(title)))
    .map(options => options[0])
  const unexpectedFields = titles.filter(field => !allExpectedTitles.includes(field))
  const duplicateFields = expectedFieldTitles
    .filter(options => titles.filter(title => options.includes(title)).length > 1)
    .map(options => options[0])
  const fieldOrderMatches = titles.length === expectedFields.length
    && expectedFieldTitles.every((options, index) => options.includes(titles[index]))
  const pageOverflow = document.documentElement.scrollWidth > innerWidth + 1
  const errors = []
  if (rows.length !== expectedFields.length)
    errors.push(`expected ${expectedFields.length} rows, measured ${rows.length}`)
  if (!fieldOrderMatches)
    errors.push(`profile fields differ: ${JSON.stringify(titles)}`)
  if (measurements.length !== expectedFields.length * 2)
    errors.push(`expected ${expectedFields.length * 2} label/control measurements, measured ${measurements.length}`)
  if (missing.length > 0)
    errors.push(`missing elements: ${JSON.stringify(missing)}`)
  if (invalid.length > 0)
    errors.push(`invalid rectangles: ${JSON.stringify(invalid)}`)
  if (overlaps.length > 0)
    errors.push(`overlaps: ${JSON.stringify(overlaps)}`)
  if (escaped.length > 0)
    errors.push(`escaped rows: ${JSON.stringify(escaped)}`)
  if (clipped.length > 0)
    errors.push(`clipped by viewport: ${JSON.stringify(clipped)}`)
  if (pageOverflow)
    errors.push('page overflows horizontally')
  return {
    viewportWidth: innerWidth,
    expectedFields,
    expectedFieldTitles,
    rows,
    measurements,
    missingFields,
    unexpectedFields,
    duplicateFields,
    fieldOrderMatches,
    missing,
    invalid,
    overlaps,
    escaped,
    clipped,
    pageOverflow,
    errors,
    valid: errors.length === 0,
  }
}
