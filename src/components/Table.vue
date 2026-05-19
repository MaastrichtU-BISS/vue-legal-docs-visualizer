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
        
        <DataTable :value="tableDocs" 
                   tableStyle="min-width: 50rem" 
                   :paginator="true" 
                   :rows="10" 
                   scrollable 
                   scrollHeight="600px"
                   v-model:filters="filters"
                   :globalFilterFields="['ecli', 'date', 'summary', 'instance', 'domain', 'decisionSummary', 'topic']">
        
        <Column v-for="col in columns" 
                :key="col.field" 
                :field="col.field" 
                :header="col.header" 
                :sortable="col.sortable"
                :sortField="col.sortField"
                :style="col.style">
            <template #body="{ data }">
                <!-- Button type -->
                <Button v-if="col.type === 'button' && data[col.field]" 
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
import { computed, ref } from 'vue'
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

// Initialize filters
const filters = ref({
  global: { value: '', matchMode: 'contains' }
})

// Column configuration
const columns = [
  { field: 'ecli', header: 'ECLI', sortable: true, style: 'min-width: 200px', type: 'default' },
  { field: 'date', header: 'Date', sortable: true, style: 'min-width: 120px', type: 'default', sortField: 'dateValue' },
  { field: 'summary', header: 'Summary', sortable: true, style: 'min-width: 300px', type: 'ellipsis', maxWidth: '300px' },
  { field: 'instance', header: 'Instance', sortable: true, style: 'min-width: 200px', type: 'default' },
  { field: 'domain', header: 'Domain', sortable: false, style: 'min-width: 180px', type: 'default' },
  { field: 'decisionSummary', header: 'Decision Summary', sortable: true, style: 'min-width: 150px', type: 'default' },
  { field: 'timesCited', header: 'Times Cited', sortable: true, style: 'min-width: 120px', type: 'default' },
  { field: 'topic', header: 'Topic', sortable: true, style: 'min-width: 150px', type: 'default' },
  { field: 'fullTextUrl', header: 'Full Text', sortable: false, style: 'min-width: 120px', type: 'button', buttonText: 'View Text' }
]

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
      fullTextUrl: data.url_publication || null
    }
  })
})

// Open full text URL in new tab
const openFullText = (url: string) => {
  window.open(url, '_blank')
}

// Export table data as CSV
const exportCSV = () => {
  if (tableDocs.value.length === 0) return
  
  // Define headers
  const headers = columns.filter(col => col.type !== 'button').map(col => col.header)
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...tableDocs.value.map(row => {
      return columns
        .filter(col => col.type !== 'button')
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
</style>
