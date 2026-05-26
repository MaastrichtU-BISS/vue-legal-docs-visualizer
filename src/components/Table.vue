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
                   :value="tableDocs" 
                   tableStyle="min-width: 50rem" 
                   :paginator="true" 
                   :rows="10" 
                   scrollable 
                   scrollHeight="600px"
                   v-model:filters="filters"
                   v-model:first="currentPage"
                   :globalFilterFields="['ecli', 'date', 'summary', 'instance', 'domain', 'decisionSummary', 'topic', 'degree', 'inDegree', 'outDegree', 'community']"
                   paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
                   currentPageReportTemplate="Showing {first} to {last} of {totalRecords} documents"
                   @row-click="onRowClick"
                   :rowHover="true"
                   :selectionMode="'single'"
                   v-model:selection="selectedRow"
                   dataKey="ecli">
        
        <Column v-for="col in columns" 
                :key="col.field" 
                :field="col.field" 
                :header="col.header" 
                :sortable="col.sortable"
                :sortField="col.sortField"
                :style="col.style">
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
                     :title="data[col.field]" 
                     :style="{ maxWidth: col.maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">
                    {{ data[col.field] }}
                </div>
                
                <!-- Default type -->
                <div v-else>
                    {{ data[col.field] !== null && data[col.field] !== undefined ? data[col.field] : '-' }}
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

export interface Props {
  docs?: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  rowClick: [doc: any]
}>()

// Initialize filters
const filters = ref({
  global: { value: '', matchMode: 'contains' }
})

const dataTable = ref<any>(null)

// Column configuration
const columns = [
  { field: 'fullTextUrl', header: 'Full Text', sortable: false, style: 'min-width: 80px; text-align: center;', type: 'link' },
  { field: 'ecli', header: 'ECLI', sortable: true, style: 'min-width: 200px', type: 'default' },
  { field: 'date', header: 'Date', sortable: true, style: 'min-width: 120px', type: 'default', sortField: 'dateValue' },
  { field: 'summary', header: 'Summary', sortable: true, style: 'min-width: 300px', type: 'ellipsis', maxWidth: '300px' },
  { field: 'instance', header: 'Instance', sortable: true, style: 'min-width: 200px', type: 'default' },
  { field: 'domain', header: 'Domain', sortable: false, style: 'min-width: 180px', type: 'default' },
  { field: 'decisionSummary', header: 'Decision Summary', sortable: true, style: 'min-width: 150px', type: 'default' },
  { field: 'timesCited', header: 'Times Cited', sortable: true, style: 'min-width: 120px', type: 'default' },
  { field: 'topic', header: 'Topic', sortable: true, style: 'min-width: 150px', type: 'default' },
  { field: 'degree', header: 'Degree', sortable: true, style: 'min-width: 100px', type: 'number', sortField: 'degreeValue' },
  { field: 'inDegree', header: 'In Degree', sortable: true, style: 'min-width: 100px', type: 'number', sortField: 'inDegreeValue' },
  { field: 'outDegree', header: 'Out Degree', sortable: true, style: 'min-width: 100px', type: 'number', sortField: 'outDegreeValue' },
  { field: 'degreeCentrality', header: 'Degree Centrality', sortable: true, style: 'min-width: 150px', type: 'number', sortField: 'degreeCentralityValue' },
  { field: 'betweennessCentrality', header: 'Betweenness', sortable: true, style: 'min-width: 130px', type: 'number', sortField: 'betweennessCentralityValue' },
  { field: 'closenessCentrality', header: 'Closeness', sortable: true, style: 'min-width: 120px', type: 'number', sortField: 'closenessCentralityValue' },
  { field: 'pageRank', header: 'PageRank', sortable: true, style: 'min-width: 120px', type: 'number', sortField: 'pageRankValue' },
  { field: 'community', header: 'Community', sortable: true, style: 'min-width: 120px', type: 'number', sortField: 'communityValue' }
]

const selectedRow = ref<any>(null)
const currentPage = ref(0)

const highlightRowById = (ecli: string) => {
  if (tableDocs.value) {
    const row = tableDocs.value.find(r => r.ecli === ecli)
    selectedRow.value = row || null
    
    if (row) {
      // Find the page containing this row
      const pageSize = 10
      const rowIndex = tableDocs.value.findIndex(r => r.ecli === ecli)
      if (rowIndex >= 0) {
        currentPage.value = Math.floor(rowIndex / pageSize) * pageSize
        
        // Scroll to the row after pagination updates
        nextTick(() => {
          nextTick(() => {
            // Find the scrollable container
            const tableBody = dataTable.value?.$el?.querySelector('.p-datatable-tbody')
            if (tableBody) {
              // Find the row containing this ECLI
              const rows = tableBody.querySelectorAll('tr')
              for (const rowElement of rows) {
                const cells = rowElement.querySelectorAll('td')
                if (cells.length > 0 && cells[0].textContent?.includes(ecli)) {
                  // Scroll the row into view within the scrollable container
                  rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  break
                }
              }
            }
          })
        })
      }
    }
  }
}

// Simplified table data structure
const tableDocs = computed(() => {
  if (!props.docs || props.docs.length === 0) return []
  
  return props.docs.map(doc => {
    const data = doc.data || {}
    
    // Parse date string to Date object for proper sorting
    const dateStr = data.date_decision
    let dateValue: Date | null = null
    let dateDisplay = '-'
    
    if (dateStr && dateStr !== '-') {
      const parsedDate = new Date(dateStr)
      // Check if date is valid
      if (!isNaN(parsedDate.getTime())) {
        dateValue = parsedDate
        dateDisplay = dateStr
      }
    }
    
    // Extract statistics
    const stats = data.statistics || {}
    const formatNumber = (val: any) => {
      if (val === null || val === undefined) return '-'
      if (typeof val === 'number') {
        if (val < 0.01 && val > 0) {
          return val.toExponential(4)
        } else if (val % 1 === 0) {
          return val.toString()
        } else {
          return val.toFixed(4)
        }
      }
      return String(val)
    }
    
    const getNumValue = (val: any) => {
      return (val !== null && val !== undefined && typeof val === 'number') ? val : null
    }
    
    return {
      ecli: doc.id || '-',
      date: dateDisplay,
      dateValue: dateValue,
      summary: data.summary || '-',
      instance: data.instance || '-',
      domain: Array.isArray(data.domains) && data.domains.length > 0 
        ? data.domains.join(', ') 
        : '-',
      decisionSummary: data.document_type || '-',
      timesCited: Array.isArray(data.cited_by) ? data.cited_by.length : 0,
      topic: data.procedure_type || '-',
      degree: formatNumber(stats.degree),
      degreeValue: getNumValue(stats.degree),
      inDegree: formatNumber(stats.inDegree),
      inDegreeValue: getNumValue(stats.inDegree),
      outDegree: formatNumber(stats.outDegree),
      outDegreeValue: getNumValue(stats.outDegree),
      degreeCentrality: formatNumber(stats.degreeCentrality),
      degreeCentralityValue: getNumValue(stats.degreeCentrality),
      betweennessCentrality: formatNumber(stats.betweennessCentrality),
      betweennessCentralityValue: getNumValue(stats.betweennessCentrality),
      closenessCentrality: formatNumber(stats.closenessCentrality),
      closenessCentralityValue: getNumValue(stats.closenessCentrality),
      pageRank: formatNumber(stats.pageRank),
      pageRankValue: getNumValue(stats.pageRank),
      community: formatNumber(stats.community),
      communityValue: getNumValue(stats.community),
      fullTextUrl: data.url_publication || null
    }
  })
})

// Handle row click - find and emit the original document
const onRowClick = (event: any) => {
  const nodeId = event.data.ecli
  highlightRowById(nodeId)
  emit('rowClick', nodeId)
}

// Open full text URL in new tab
const openFullText = (url: string) => {
  window.open(url, '_blank')
}

// Export table data as CSV
const exportCSV = () => {
  if (tableDocs.value.length === 0) return
  // Define headers
  const headers = columns.filter(col => col.type !== 'button' && col.type !== 'link').map(col => col.header)
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...tableDocs.value.map(row => {
      return columns
        .filter(col => col.type !== 'button' && col.type !== 'link')
        .map(col => {
          const value = (row as any)[col.field]
          // Escape quotes and wrap in quotes if contains comma or newline
          const stringValue = String(value || '')
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        })
        .join(',')
    })
  ].join('\n')
  
  // Create download link
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
