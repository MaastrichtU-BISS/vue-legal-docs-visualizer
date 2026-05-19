<template>
    <DataTable :value="tableDocs" tableStyle="min-width: 50rem" :paginator="true" :rows="10" 
               scrollable scrollHeight="600px">
        
        <Column v-for="col in columns" 
                :key="col.field" 
                :field="col.field" 
                :header="col.header" 
                :sortable="col.sortable"
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
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'

export interface Props {
  docs?: any[]
}

const props = defineProps<Props>()

// Column configuration
const columns = [
  { field: 'ecli', header: 'ECLI', sortable: true, style: 'min-width: 200px', type: 'default' },
  { field: 'date', header: 'Date', sortable: true, style: 'min-width: 120px', type: 'default' },
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
    
    return {
      ecli: doc.id || '-',
      date: data.date_decision || '-',
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

</script>
