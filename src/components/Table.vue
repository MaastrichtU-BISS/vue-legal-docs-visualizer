<template>
    <div class="table-container">
        <div class="search-bar">
            <IconField>
                <InputIcon>
                    <i class="pi pi-search" />
                </InputIcon>
                <InputText v-model="filters['global'].value" placeholder="Search..." />
            </IconField>

            <Button label="Export CSV" icon="pi pi-download" @click="exportCSV" size="small" />
        </div>

        <DataTable ref="dataTable"
                   :value="model.rows"
                   tableStyle="min-width: 50rem"
                   :paginator="true"
                   :rows="10"
                   scrollable
                   v-model:filters="filters"
                   v-model:first="currentPage"
                   :globalFilterFields="globalFilterFields"
                   paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
                   currentPageReportTemplate="Showing {first} to {last} of {totalRecords} documents"
                   @row-click="onRowClick"
                   :rowHover="true"
                   :selectionMode="'single'"
                   v-model:selection="selectedRow"
                   dataKey="__id">

        <Column v-for="col in model.columns"
                :key="col.field"
                :field="col.field"
                :header="col.header"
                :sortable="col.sortable"
                :style="columnStyle(col)">
            <template #body="{ data }">
                <!-- Link type -->
                <Button v-if="col.type === 'link' && data[col.field]"
                        @click="openFullText(data[col.field])"
                        icon="pi pi-external-link"
                        text
                        rounded
                        severity="secondary"
                        size="small" />

                <!-- Button type -->
                <Button v-else-if="col.type === 'button' && data[col.field]"
                        @click="openFullText(data[col.field])"
                        :label="col.buttonText"
                        size="small" />

                <!-- Ellipsis type -->
                <div v-else-if="col.type === 'ellipsis' && data[col.field]"
                     :title="display(col, data)"
                     :style="{ maxWidth: col.maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">
                    {{ display(col, data) }}
                </div>

                <!-- Default type -->
                <div v-else>
                    {{ display(col, data) }}
                </div>
            </template>
        </Column>
    </DataTable>
    </div>
</template>

<script lang="ts" setup>
import { computed, ref, nextTick } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import type { LegalDocument, LegalEdge } from './types'
import {
  caseLawConfig,
  documentSetFromLegalDocs,
  resolveVisualizerConfig,
  type DocumentSetV1,
  type VisualizerConfig,
} from '../config'
import { buildTableModel, formatCell, type TableColumn, type TableRow } from '../table'

export interface Props {
  /** Canonical input. When absent, `docs`/`edges` are adapted. */
  graph?: DocumentSetV1
  /** A preset id or a full config. Defaults to the case-law preset. */
  config?: VisualizerConfig | string
  /** Legacy case-law input, still supported. */
  docs?: LegalDocument[]
  edges?: LegalEdge[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  docClick: [id: string]
}>()

const effectiveGraph = computed<DocumentSetV1>(
  () =>
    props.graph ??
    documentSetFromLegalDocs((props.docs as LegalDocument[]) ?? [], (props.edges as LegalEdge[]) ?? []),
)

const effectiveConfig = computed<VisualizerConfig>(
  () => resolveVisualizerConfig(props.config) ?? caseLawConfig,
)

const model = computed(() => buildTableModel(effectiveGraph.value, effectiveConfig.value))
const globalFilterFields = computed(() => model.value.columns.map((col) => col.field))

// Initialize filters
const filters = ref({
  global: { value: '', matchMode: 'contains' }
})

const dataTable = ref<any>(null)
const selectedRow = ref<TableRow | null>(null)
const currentPage = ref(0)

function columnStyle(col: TableColumn) {
  const style: Record<string, string> = {}
  if (col.width) style.minWidth = col.width
  if (col.type === 'link' || col.type === 'button') style.textAlign = 'center'
  return style
}

function display(col: TableColumn, row: TableRow): string {
  return formatCell(row[col.field], col, row.__node)
}

const highlightRowById = (id: string) => {
  const row = model.value.rows.find((candidate) => candidate.__id === id) ?? null
  selectedRow.value = row
  if (!row) return

  const pageSize = 10
  const rowIndex = model.value.rows.findIndex((candidate) => candidate.__id === id)
  if (rowIndex >= 0) {
    currentPage.value = Math.floor(rowIndex / pageSize) * pageSize

    nextTick(() => {
      nextTick(() => {
        const tableBody = dataTable.value?.$el?.querySelector('.p-datatable-tbody')
        if (!tableBody) return
        const rows = tableBody.querySelectorAll('tr')
        for (const rowElement of rows) {
          const cells = rowElement.querySelectorAll('td')
          if (cells.length > 0 && cells[0].textContent?.includes(id)) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            break
          }
        }
      })
    })
  }
}

// Handle row click - emit the node id
const onRowClick = (event: { data: TableRow }) => {
  const id = event.data.__id
  highlightRowById(id)
  emit('docClick', id)
}

// Open full text URL in new tab
const openFullText = (url: string) => {
  window.open(url, '_blank')
}

// Export table data as CSV
const exportCSV = () => {
  if (model.value.rows.length === 0) return
  const columns = model.value.columns.filter((col) => col.type !== 'button' && col.type !== 'link')
  const headers = columns.map((col) => col.header)

  const csvContent = [
    headers.join(','),
    ...model.value.rows.map((row) => {
      return columns
        .map((col) => {
          const value = formatCell(row[col.field], col, row.__node)
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(',')
    })
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `legal-documents-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

defineExpose({
  highlightRowById
})
</script>

<style scoped>
.table-container {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.search-bar {
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.search-bar :deep(.p-iconfield) {
  width: 100%;
  max-width: 400px;
}

.table-container :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}
</style>
