pdfjsLib.GlobalWorkerOptions.workerSrc =
	'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// State
let fileQueue = []
let isConverting = false
let nextId = 0

// DOM refs
const dropZone = document.getElementById('dropZone')
const fileInput = document.getElementById('fileInput')
const convertBtn = document.getElementById('convertBtn')
const clearBtn = document.getElementById('clearBtn')
const dlAllBtn = document.getElementById('dlAllBtn')
const overallProgress = document.getElementById('overallProgress')
const overallFill = document.getElementById('overallFill')
const overallText = document.getElementById('overallText')
const overallCount = document.getElementById('overallCount')
const queueSection = document.getElementById('queueSection')
const queueList = document.getElementById('queueList')
const queueCount = document.getElementById('queueCount')
const resultsSection = document.getElementById('resultsSection')
const resultsContainer = document.getElementById('resultsContainer')
const scaleRange = document.getElementById('scaleRange')
const scaleVal = document.getElementById('scaleVal')
const qualityRange = document.getElementById('qualityRange')
const qualityVal = document.getElementById('qualityVal')
const pageRangeSelect = document.getElementById('pageRange')
const customRangeItem = document.getElementById('customRangeItem')
const customRangeInput = document.getElementById('customRange')
const lightbox = document.getElementById('lightbox')
const lightboxImg = document.getElementById('lightboxImg')
const lightboxClose = document.getElementById('lightboxClose')
const toast = document.getElementById('toast')

// Sliders
scaleRange.addEventListener('input', () => {
	scaleVal.textContent = scaleRange.value + '×'
})
qualityRange.addEventListener('input', () => {
	qualityVal.textContent = qualityRange.value + '%'
})
pageRangeSelect.addEventListener('change', () => {
	customRangeItem.style.display =
		pageRangeSelect.value === 'custom' ? 'block' : 'none'
})

// Drop / file select
dropZone.addEventListener('click', () => fileInput.click())
dropZone.addEventListener('dragover', (e) => {
	e.preventDefault()
	dropZone.classList.add('dragover')
})
dropZone.addEventListener('dragleave', () =>
	dropZone.classList.remove('dragover'),
)
dropZone.addEventListener('drop', (e) => {
	e.preventDefault()
	dropZone.classList.remove('dragover')
	const files = [...e.dataTransfer.files].filter(
		(f) => f.type === 'application/pdf',
	)
	if (!files.length) {
		showToast('No valid PDF files found')
		return
	}
	addFiles(files)
})
fileInput.addEventListener('change', () => {
	const files = [...fileInput.files]
	if (files.length) addFiles(files)
	fileInput.value = ''
})

// Add files to queue
async function addFiles(files) {
	for (const file of files) {
		const id = nextId++
		const entry = {
			id,
			file,
			pdfDoc: null,
			name: file.name.replace(/\.pdf$/i, ''),
			status: 'loading',
			pages: 0,
			images: [],
			rowEl: null,
			fillEl: null,
			progWrapEl: null,
			progTextEl: null,
			progCountEl: null,
			pagesEl: null,
			statusBadge: null,
		}
		fileQueue.push(entry)
		const row = buildFileRow(entry)
		entry.rowEl = row
		queueList.appendChild(row)
	}

	updateQueueHeader()
	queueSection.style.display = 'block'
	clearBtn.disabled = false

	// Load PDFs (async, update row as each resolves)
	for (const entry of fileQueue.filter((e) => e.status === 'loading')) {
		try {
			const buf = await entry.file.arrayBuffer()
			entry.pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise
			entry.pages = entry.pdfDoc.numPages
			entry.status = 'waiting'
			entry.pagesEl.textContent = `${entry.pages} page${entry.pages !== 1 ? 's' : ''}`
			setRowStatus(entry, 'waiting')
		} catch (err) {
			entry.status = 'error'
			entry.pagesEl.textContent = 'Could not read PDF'
			setRowStatus(entry, 'error')
		}
		syncConvertBtn()
	}
}

function syncConvertBtn() {
	convertBtn.disabled =
		isConverting || !fileQueue.some((e) => e.status === 'waiting')
}

// Build a file row
function buildFileRow(entry) {
	const row = document.createElement('div')
	row.className = 'file-row'
	row.dataset.id = entry.id

	row.innerHTML = `
      <div class="file-row-icon">📑</div>
      <div class="file-row-body">
        <div class="file-row-name">${escHtml(entry.file.name)}</div>
        <div class="file-row-meta">
          <span>${formatBytes(entry.file.size)}</span>
          <span data-pages>Loading…</span>
        </div>
        <div class="file-progress-wrap" data-prog-wrap style="display:none">
          <div class="file-progress-track">
            <div class="file-progress-fill" data-fill></div>
          </div>
          <div class="file-progress-label">
            <span data-prog-text></span>
            <span data-prog-count></span>
          </div>
        </div>
      </div>
      <div class="file-row-actions">
        <span class="status-badge badge-loading" data-status-badge>Loading</span>
        <button class="btn-remove-file" data-remove title="Remove">✕</button>
      </div>
    `

	entry.fillEl = row.querySelector('[data-fill]')
	entry.progWrapEl = row.querySelector('[data-prog-wrap]')
	entry.progTextEl = row.querySelector('[data-prog-text]')
	entry.progCountEl = row.querySelector('[data-prog-count]')
	entry.pagesEl = row.querySelector('[data-pages]')
	entry.statusBadge = row.querySelector('[data-status-badge]')

	row.querySelector('[data-remove]').addEventListener('click', () => {
		if (isConverting && entry.status === 'converting') return
		fileQueue = fileQueue.filter((e) => e.id !== entry.id)
		row.remove()
		updateQueueHeader()
		if (!fileQueue.length) {
			queueSection.style.display = 'none'
			clearBtn.disabled = true
		}
		syncConvertBtn()
	})

	return row
}

function setRowStatus(entry, status) {
	const labels = {
		loading: 'Loading',
		waiting: 'Waiting',
		converting: 'Converting',
		done: 'Done',
		error: 'Error',
	}
	const classes = {
		loading: 'badge-loading',
		waiting: 'badge-waiting',
		converting: 'badge-converting',
		done: 'badge-done',
		error: 'badge-error',
	}
	entry.statusBadge.textContent = labels[status]
	entry.statusBadge.className = `status-badge ${classes[status]}`
	entry.rowEl.classList.remove('state-converting', 'state-done', 'state-error')
	if (status === 'converting') entry.rowEl.classList.add('state-converting')
	if (status === 'done') entry.rowEl.classList.add('state-done')
	if (status === 'error') entry.rowEl.classList.add('state-error')
}

function updateQueueHeader() {
	queueCount.textContent = `${fileQueue.length} file${fileQueue.length !== 1 ? 's' : ''}`
}

// Convert
convertBtn.addEventListener('click', runConversion)

async function runConversion() {
	const toConvert = fileQueue.filter((e) => e.status === 'waiting')
	if (!toConvert.length) return

	isConverting = true
	convertBtn.disabled = true
	clearBtn.disabled = true
	dlAllBtn.disabled = true
	resultsSection.classList.remove('visible')
	resultsContainer.innerHTML = ''

	const scale = parseFloat(scaleRange.value)
	const quality = parseInt(qualityRange.value) / 100
	const rangeMode = pageRangeSelect.value
	const customStr = customRangeInput.value.trim()

	// Pre-calculate pages per file
	const pagesMap = {}
	let totalPages = 0
	for (const entry of toConvert) {
		const pages = resolvePages(rangeMode, customStr, entry.pages)
		pagesMap[entry.id] = pages
		totalPages += pages.length
	}

	let donePages = 0
	overallProgress.classList.add('active')
	overallFill.style.width = '0%'
	overallText.textContent = `Converting ${toConvert.length} file${toConvert.length !== 1 ? 's' : ''}…`
	overallCount.textContent = `0 / ${totalPages} pages`

	for (const entry of toConvert) {
		const pages = pagesMap[entry.id]

		if (!pages.length) {
			entry.status = 'error'
			setRowStatus(entry, 'error')
			entry.pagesEl.textContent = 'Invalid page range'
			continue
		}

		entry.status = 'converting'
		entry.images = []
		setRowStatus(entry, 'converting')
		entry.progWrapEl.style.display = 'block'
		entry.fillEl.style.width = '0%'
		entry.progTextEl.textContent = 'Starting…'
		entry.progCountEl.textContent = `0 / ${pages.length}`

		for (let i = 0; i < pages.length; i++) {
			const pageNum = pages[i]
			entry.progTextEl.textContent = `Rendering page ${pageNum}`
			entry.progCountEl.textContent = `${i + 1} / ${pages.length}`

			const dataUrl = await renderPage(entry.pdfDoc, pageNum, scale, quality)
			entry.images.push({ pageNum, dataUrl })

			entry.fillEl.style.width =
				(((i + 1) / pages.length) * 100).toFixed(1) + '%'

			donePages++
			overallFill.style.width =
				((donePages / totalPages) * 100).toFixed(1) + '%'
			overallCount.textContent = `${donePages} / ${totalPages} pages`
		}

		entry.status = 'done'
		setRowStatus(entry, 'done')
		entry.progTextEl.textContent = '✓ Complete'
		entry.progCountEl.textContent = `${entry.images.length} images`

		// Add inline download button to row
		addRowDownloadBtn(entry)
	}

	// Build results panels
	const doneEntries = fileQueue.filter(
		(e) => e.status === 'done' && e.images.length,
	)
	if (doneEntries.length) {
		doneEntries.forEach(buildResultGroup)
		resultsSection.classList.add('visible')
	}

	const totalImages = doneEntries.reduce((s, e) => s + e.images.length, 0)
	overallText.textContent = `✓ ${totalImages} image${totalImages !== 1 ? 's' : ''} ready`
	dlAllBtn.disabled = totalImages === 0
	isConverting = false
	clearBtn.disabled = false
	syncConvertBtn()
	showToast(
		`✓ ${totalImages} images from ${doneEntries.length} file${doneEntries.length !== 1 ? 's' : ''}`,
	)
}

function addRowDownloadBtn(entry) {
	const actions = entry.rowEl.querySelector('.file-row-actions')
	const existing = actions.querySelector('.btn-dl-file')
	if (existing) existing.remove()
	const btn = document.createElement('button')
	btn.className = 'btn-dl-file'
	btn.textContent = `↓ ${entry.images.length} JPG`
	btn.addEventListener('click', () => {
		if (entry.images.length > 1) {
			downloadAllAsZip(entry.images, entry.name)
		} else {
			downloadAll(entry.images, entry.name)
		}
	})
	actions.insertBefore(btn, actions.querySelector('.btn-remove-file'))
}

// Render one page to JPEG data URL
async function renderPage(pdfDoc, pageNum, scale, quality) {
	const page = await pdfDoc.getPage(pageNum)
	const viewport = page.getViewport({ scale })
	const canvas = document.createElement('canvas')
	canvas.width = viewport.width
	canvas.height = viewport.height
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = '#ffffff'
	ctx.fillRect(0, 0, canvas.width, canvas.height)
	await page.render({ canvasContext: ctx, viewport }).promise
	return canvas.toDataURL('image/jpeg', quality)
}

// Build result group for one PDF
function buildResultGroup(entry) {
	const group = document.createElement('div')
	group.className = 'results-file-group'

	const hdr = document.createElement('div')
	hdr.className = 'results-file-header'
	hdr.innerHTML = `
      <h4>${escHtml(entry.file.name)}</h4>
      <div class="rh-right">
        <span>${entry.images.length} image${entry.images.length !== 1 ? 's' : ''}</span>
        <button class="btn-dl-group">↓ Download all</button>
      </div>
    `
	hdr
		.querySelector('.btn-dl-group')
		.addEventListener('click', () => {
			if (entry.images.length > 1) {
				downloadAllAsZip(entry.images, entry.name)
			} else {
				downloadAll(entry.images, entry.name)
			}
		})
	group.appendChild(hdr)

	const grid = document.createElement('div')
	grid.className = 'results-grid'

	entry.images.forEach(({ pageNum, dataUrl }, idx) => {
		const card = document.createElement('div')
		card.className = 'result-card'
		card.style.animationDelay = idx * 0.03 + 's'

		const img = document.createElement('img')
		img.className = 'card-thumb'
		img.src = dataUrl
		img.loading = 'lazy'
		img.title = 'Click to preview'
		img.addEventListener('click', () => openLightbox(dataUrl))

		const footer = document.createElement('div')
		footer.className = 'card-footer'

		const lbl = document.createElement('span')
		lbl.className = 'card-label'
		lbl.textContent = `p.${pageNum}`

		const dlBtn = document.createElement('button')
		dlBtn.className = 'btn-dl-single'
		dlBtn.textContent = '↓ Save'
		dlBtn.addEventListener('click', () =>
			downloadImage(dataUrl, `${entry.name}_p${pageNum}.jpg`),
		)

		footer.appendChild(lbl)
		footer.appendChild(dlBtn)
		card.appendChild(img)
		card.appendChild(footer)
		grid.appendChild(card)
	})

	group.appendChild(grid)
	resultsContainer.appendChild(group)
}

// Downloads
function downloadImage(dataUrl, filename) {
	const a = document.createElement('a')
	a.href = dataUrl
	a.download = filename
	a.click()
}

function downloadAll(images, baseName) {
	images.forEach(({ pageNum, dataUrl }) =>
		downloadImage(dataUrl, `${baseName}_p${pageNum}.jpg`),
	)
}

async function downloadAllAsZip(images, baseName) {
	const zip = new JSZip()

	// Convert data URLs to blobs and add to zip
	for (const { pageNum, dataUrl } of images) {
		const blob = await fetch(dataUrl).then(r => r.blob())
		zip.file(`${baseName}_p${pageNum}.jpg`, blob)
	}

	// Generate and download ZIP
	const zipBlob = await zip.generateAsync({ type: 'blob' })
	const url = URL.createObjectURL(zipBlob)
	const a = document.createElement('a')
	a.href = url
	a.download = `${baseName}.zip`
	a.click()
	URL.revokeObjectURL(url)
}

async function downloadAllFilesAsZip() {
	const doneFiles = fileQueue.filter((e) => e.status === 'done' && e.images.length)
	if (!doneFiles.length) return

	const zip = new JSZip()

	// Add all images from all files to the ZIP
	for (const entry of doneFiles) {
		for (const { pageNum, dataUrl } of entry.images) {
			const blob = await fetch(dataUrl).then(r => r.blob())
			zip.file(`${entry.name}_p${pageNum}.jpg`, blob)
		}
	}

	// Generate and download ZIP
	showToast('Generating ZIP file...')
	const zipBlob = await zip.generateAsync({ type: 'blob' })
	const url = URL.createObjectURL(zipBlob)
	const a = document.createElement('a')
	a.href = url
	a.download = 'converted_images.zip'
	a.click()
	URL.revokeObjectURL(url)
}

dlAllBtn.addEventListener('click', () => {
	downloadAllFilesAsZip()
})

// Clear all
clearBtn.addEventListener('click', () => {
	if (isConverting) return
	fileQueue = []
	queueList.innerHTML = ''
	queueSection.style.display = 'none'
	resultsSection.classList.remove('visible')
	resultsContainer.innerHTML = ''
	overallProgress.classList.remove('active')
	convertBtn.disabled = true
	clearBtn.disabled = true
	dlAllBtn.disabled = true
	fileInput.value = ''
})

// Lightbox
function openLightbox(src) {
	lightboxImg.src = src
	lightbox.classList.add('open')
}

lightboxClose.addEventListener('click', () => lightbox.classList.remove('open'))
lightbox.addEventListener('click', (e) => {
	if (e.target === lightbox || e.target === lightboxImg)
		lightbox.classList.remove('open')
})
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') lightbox.classList.remove('open')
})

// Page range helpers
function resolvePages(mode, customStr, total) {
	if (mode === 'all') return Array.from({ length: total }, (_, i) => i + 1)
	if (mode === 'first') return [1]
	return parsePageRange(customStr, total)
}

function parsePageRange(str, total) {
	if (!str) return []
	const pages = new Set()
	for (const part of str.split(',')) {
		const t = part.trim()
		if (/^\d+$/.test(t)) {
			const n = parseInt(t)
			if (n >= 1 && n <= total) pages.add(n)
		} else if (/^\d+-\d+$/.test(t)) {
			const [a, b] = t.split('-').map(Number)
			for (let i = Math.min(a, b); i <= Math.max(a, b); i++)
				if (i >= 1 && i <= total) pages.add(i)
		}
	}
	return [...pages].sort((a, b) => a - b)
}

// Utils
function formatBytes(b) {
	if (b < 1024) return b + ' B'
	if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
	return (b / 1048576).toFixed(1) + ' MB'
}

function escHtml(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

let toastTimer
function showToast(msg) {
	clearTimeout(toastTimer)
	toast.textContent = msg
	toast.classList.add('show')
	toastTimer = setTimeout(() => toast.classList.remove('show'), 3000)
}
