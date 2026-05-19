<template>
    <Drawer v-model:visible="isVisible" position="right" :modal="false" class="document-drawer" :style="{ width: '400px' }">
        <template #header>
            <div class="drawer-header">
                <h2>Document Details</h2>
            </div>
        </template>

        <div v-if="document" class="document-content">
            <!-- ECLI Section -->
            <div class="info-section">
                <h3 class="section-title">Identifier</h3>
                <div class="info-field">
                    <span class="field-label">ECLI:</span>
                    <span class="field-value">{{ document.id }}</span>
                </div>
            </div>

            <!-- Basic Information -->
            <div class="info-section" v-if="document.data">
                <h3 class="section-title">Basic Information</h3>
                
                <div class="info-field" v-if="document.data.date_decision">
                    <span class="field-label">Date:</span>
                    <span class="field-value">{{ document.data.date_decision }}</span>
                </div>

                <div class="info-field" v-if="document.data.instance">
                    <span class="field-label">Instance:</span>
                    <span class="field-value">{{ document.data.instance }}</span>
                </div>

                <div class="info-field" v-if="document.data.domains && document.data.domains.length > 0">
                    <span class="field-label">Domains:</span>
                    <span class="field-value">{{ document.data.domains.join(', ') }}</span>
                </div>

                <div class="info-field" v-if="document.data.document_type">
                    <span class="field-label">Document Type:</span>
                    <span class="field-value">{{ document.data.document_type }}</span>
                </div>

                <div class="info-field" v-if="document.data.procedure_type">
                    <span class="field-label">Procedure Type:</span>
                    <span class="field-value">{{ document.data.procedure_type }}</span>
                </div>

                <div class="info-field" v-if="document.data.jurisdiction_country">
                    <span class="field-label">Jurisdiction:</span>
                    <span class="field-value">{{ document.data.jurisdiction_country }}</span>
                </div>

                <div class="info-field" v-if="document.data.source">
                    <span class="field-label">Source:</span>
                    <span class="field-value">{{ document.data.source }}</span>
                </div>
            </div>

            <!-- Summary -->
            <div class="info-section" v-if="document.data?.summary">
                <h3 class="section-title">Summary</h3>
                <p class="summary-text">{{ document.data.summary }}</p>
            </div>

            <!-- Legal Provisions -->
            <div class="info-section" v-if="document.data?.legal_provisions && document.data.legal_provisions.length > 0">
                <h3 class="section-title">Legal Provisions</h3>
                <ul class="provision-list">
                    <li v-for="(provision, index) in document.data.legal_provisions" :key="index">
                        {{ provision }}
                    </li>
                </ul>
            </div>

            <!-- Citations -->
            <div class="info-section" v-if="document.data?.cites && document.data.cites.length > 0">
                <h3 class="section-title">Cites ({{ document.data.cites.length }})</h3>
                <ul class="citation-list">
                    <li v-for="(cite, index) in document.data.cites" :key="index">
                        <span v-if="isEcliInDocs(cite)" class="citation-link" @click="handleCitationClick(cite)">
                            {{ cite }}
                        </span>
                        <span v-else class="citation-text">
                            {{ cite }}
                        </span>
                    </li>
                </ul>
            </div>

            <!-- Cited By -->
            <div class="info-section" v-if="document.data?.cited_by && document.data.cited_by.length > 0">
                <h3 class="section-title">Cited By ({{ document.data.cited_by.length }})</h3>
                <ul class="citation-list">
                    <li v-for="(cite, index) in document.data.cited_by" :key="index">
                        <span v-if="isEcliInDocs(cite)" class="citation-link" @click="handleCitationClick(cite)">
                            {{ cite }}
                        </span>
                        <span v-else class="citation-text">
                            {{ cite }}
                        </span>
                    </li>
                </ul>
            </div>

            <!-- URL -->
            <div class="info-section" v-if="document.data?.url_publication">
                <h3 class="section-title">Publication</h3>
                <a :href="document.data.url_publication" target="_blank" class="publication-link">
                    View Full Text <i class="pi pi-external-link"></i>
                </a>
            </div>
        </div>
    </Drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Drawer from 'primevue/drawer'

export interface Props {
    document?: any
    visible?: boolean
    docs?: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
    'update:visible': [value: boolean]
    'citation-click': [ecli: string]
}>()

const isVisible = ref(props.visible || false)

watch(() => props.visible, (newVal) => {
    isVisible.value = newVal || false
})

watch(isVisible, (newVal) => {
    emit('update:visible', newVal)
})

const isEcliInDocs = (ecli: string): boolean => {
    if (!props.docs || props.docs.length === 0) return false
    return props.docs.some(doc => doc.id === ecli)
}

const handleCitationClick = (ecli: string) => {
    emit('citation-click', ecli)
}
</script>

<style scoped>
.document-drawer {
    width: 1000px;
}

.drawer-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
}

.document-content {
    padding: 0;
    overflow-y: auto;
    font-size: 14px;
}

.info-section {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5e7eb;
}

.info-section:last-child {
    border-bottom: none;
}

.section-title {
    font-size: 15px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 10px 0;
}

.info-field {
    display: flex;
    margin-bottom: 6px;
    gap: 12px;
}

.field-label {
    font-weight: 600;
    color: #6b7280;
    min-width: 120px;
    flex-shrink: 0;
    font-size: 13px;
}

.field-value {
    color: #1f2937;
    flex: 1;
    font-size: 14px;
}

.summary-text {
    color: #374151;
    line-height: 1.6;
    margin: 0;
    font-size: 14px;
}

.tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.tag {
    background-color: #e0e7ff;
    color: #4f46e5;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
}

.provision-list,
.citation-list {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
}

.provision-list li,
.citation-list li {
    color: #374151;
    margin-bottom: 4px;
    line-height: 1.5;
}

.publication-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
    font-size: 14px;
}

.publication-link:hover {
    text-decoration: underline;
}

.publication-link i {
    font-size: 12px;
}

.citation-link {
    color: #3b82f6;
    cursor: pointer;
    text-decoration: underline;
}

.citation-link:hover {
    color: #2563eb;
}

.citation-text {
    color: #6b7280;
}
</style>
