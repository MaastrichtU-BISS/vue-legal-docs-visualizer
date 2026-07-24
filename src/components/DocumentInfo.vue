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

                <template v-if="rsData">
                    <div class="info-field" v-if="rsData.instance">
                        <span class="field-label">Instance:</span>
                        <span class="field-value">{{ rsData.instance }}</span>
                    </div>

                    <div class="info-field" v-if="rsData.domains && rsData.domains.length > 0">
                        <span class="field-label">Domains:</span>
                        <span class="field-value">{{ rsData.domains.join(', ') }}</span>
                    </div>

                    <div class="info-field" v-if="rsData.document_type">
                        <span class="field-label">Document Type:</span>
                        <span class="field-value">{{ rsData.document_type }}</span>
                    </div>

                    <div class="info-field" v-if="rsData.procedure_type">
                        <span class="field-label">Procedure Type:</span>
                        <span class="field-value">{{ rsData.procedure_type }}</span>
                    </div>

                    <div class="info-field" v-if="rsData.jurisdiction_country">
                        <span class="field-label">Jurisdiction:</span>
                        <span class="field-value">{{ rsData.jurisdiction_country }}</span>
                    </div>
                </template>

                <template v-else-if="echrData">
                    <div class="info-field" v-if="echrData.respondent_state">
                        <span class="field-label">Respondent State:</span>
                        <span class="field-value">{{ echrData.respondent_state }}</span>
                    </div>

                    <div class="info-field" v-if="echrData.keywords && echrData.keywords.length > 0">
                        <span class="field-label">Keywords:</span>
                        <span class="field-value">{{ echrData.keywords.join(', ') }}</span>
                    </div>

                    <div class="info-field" v-if="echrData.document_type">
                        <span class="field-label">Document Type:</span>
                        <span class="field-value">{{ echrData.document_type }}</span>
                    </div>

                    <div class="info-field" v-if="echrData.importance !== undefined && echrData.importance !== null">
                        <span class="field-label">Importance:</span>
                        <span class="field-value">{{ echrData.importance }}/4</span>
                    </div>
                </template>
            </div>

            <!-- Summary -->
            <div class="info-section" v-if="rsData?.summary">
                <h3 class="section-title">Summary</h3>
                <p class="summary-text">{{ rsData.summary }}</p>
            </div>
            <div class="info-section" v-else-if="echrData?.conclusion">
                <h3 class="section-title">Conclusion</h3>
                <p class="summary-text">{{ echrData.conclusion }}</p>
            </div>

            <!-- Legal Provisions -->
            <div class="info-section" v-if="rsData?.legal_provisions && rsData.legal_provisions.length > 0">
                <h3 class="section-title">Legal Provisions</h3>
                <ul class="provision-list">
                    <li v-for="(provision, index) in rsData.legal_provisions" :key="index">
                        {{ provision }}
                    </li>
                </ul>
            </div>

            <!-- Articles (ECHR only) -->
            <div class="info-section"
                v-if="echrData && (toArticleList(echrData.article_violated).length > 0 || toArticleList(echrData.article_applied).length > 0)">
                <h3 class="section-title">Articles</h3>
                <div class="info-field" v-if="toArticleList(echrData.article_violated).length > 0">
                    <span class="field-label">Violated:</span>
                    <span class="field-value">{{ toArticleList(echrData.article_violated).join(', ') }}</span>
                </div>
                <div class="info-field" v-if="toArticleList(echrData.article_applied).length > 0">
                    <span class="field-label">Applied:</span>
                    <span class="field-value">{{ toArticleList(echrData.article_applied).join(', ') }}</span>
                </div>
            </div>

            <!-- Statistics -->
            <div class="info-section" v-if="document.data?.statistics">
                <h3 class="section-title">Statistics</h3>
                <div class="stats-list">
                    <div class="info-field" v-for="(value, key) in document.data.statistics" :key="key">
                        <template v-if="key != 'parent'">
                            <span class="field-label">{{ formatStatKey(key) }}:</span>
                            <span class="field-value">{{ formatStatValue(value) }}</span>
                        </template>
                    </div>
                </div>
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
            <div class="info-section" v-if="rsData?.url_publication">
                <h3 class="section-title">Publication</h3>
                <a :href="rsData.url_publication" target="_blank" class="publication-link">
                    View Full Text <i class="pi pi-external-link"></i>
                </a>
            </div>
            <div class="info-section" v-else-if="echrData?.itemid">
                <h3 class="section-title">Publication</h3>
                <a :href="buildHudocUrl(echrData.itemid)" target="_blank" class="publication-link">
                    View Full Text <i class="pi pi-external-link"></i>
                </a>
            </div>
        </div>
    </Drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { RechtspraakDocumentData, EchrDocumentData } from 'legal-docs-client'
import { isEchrDocument, type LegalDocument } from './types'
import Drawer from 'primevue/drawer'

export interface Props {
    document?: LegalDocument | null
    visible?: boolean
    docs?: LegalDocument[]
}

const props = defineProps<Props>()

const rsData = computed<RechtspraakDocumentData | null>(() =>
    props.document && !isEchrDocument(props.document) ? props.document.data as RechtspraakDocumentData : null
)

const echrData = computed<EchrDocumentData | null>(() =>
    props.document && isEchrDocument(props.document) ? props.document.data as EchrDocumentData : null
)

const toArticleList = (value?: string | string[]): string[] => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

const buildHudocUrl = (itemid: string): string => {
    const encodedItemid = encodeURIComponent(itemid)
    return `https://hudoc.echr.coe.int/eng#%7B%22itemid%22:%5B%22${encodedItemid}%22%5D%7D`
}

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

const formatStatKey = (key: string): string => {
    // Convert camelCase to Title Case with spaces
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
}

const formatStatValue = (value: any): string => {
    if (typeof value === 'number') {
        // Format numbers with appropriate precision
        if (value < 0.01 && value > 0) {
            return value.toExponential(4)
        } else if (value % 1 === 0) {
            return value.toString()
        } else {
            return value.toFixed(4)
        }
    }
    return String(value)
}
</script>

<style>
/* Non-scoped to apply to PrimeVue Drawer which renders outside component tree */
.document-drawer {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}
</style>

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

.stats-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
