import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { formatClp, itemStatusMeta, itemTypeMeta } from '../domain/constants'
import { getDayItems, getPlanDays, getPlanSummary, getUnassignedItems } from '../domain/selectors'
import type { Workspace } from '../domain/types'

const styles = StyleSheet.create({
  page: { padding: 34, fontSize: 9, color: '#1f2d29', fontFamily: 'Helvetica' },
  cover: { backgroundColor: '#173f35', color: '#f6f1e5', justifyContent: 'space-between' },
  eyebrow: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#d79a68', marginBottom: 14 },
  title: { fontSize: 34, lineHeight: 1.05, fontFamily: 'Helvetica-Bold', marginBottom: 16 },
  subtitle: { fontSize: 13, lineHeight: 1.4, maxWidth: 350, color: '#dbe7e0' },
  coverStats: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#52756d', paddingTop: 16 },
  stat: { width: '30%' }, statValue: { fontSize: 18, fontFamily: 'Helvetica-Bold' }, statLabel: { color: '#b6cbc4', marginTop: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#d8d2c4' },
  dayTitle: { fontSize: 21, fontFamily: 'Helvetica-Bold', color: '#173f35' },
  dayMeta: { color: '#68756f', marginTop: 3 },
  item: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#e4dfd4' },
  time: { width: 42, fontFamily: 'Helvetica-Bold', color: '#ad542f' },
  itemBody: { flexGrow: 1, paddingRight: 10 }, itemTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  itemMeta: { color: '#68756f', marginTop: 3 }, notes: { marginTop: 4, lineHeight: 1.35 },
  cost: { width: 70, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 18, left: 34, right: 34, flexDirection: 'row', justifyContent: 'space-between', color: '#7b8580', fontSize: 7 },
})

function RoadbookDocument({ workspace }: { workspace: Workspace }) {
  const days = getPlanDays(workspace)
  const summary = getPlanSummary(workspace)
  const activePlan = workspace.plans.find((plan) => plan.id === workspace.selectedPlanId)
  return (
    <Document title={`${workspace.trip.name} · Roadbook`} author="Ruta Austral">
      <Page size="A4" style={[styles.page, styles.cover]}>
        <View><Text style={styles.eyebrow}>ROADBOOK · PATAGONIA CHILENA</Text><Text style={styles.title}>{workspace.trip.name}</Text><Text style={styles.subtitle}>{activePlan?.name} · Una guía operativa para llevar la ruta, reservas, gastos y decisiones importantes incluso sin conexión.</Text></View>
        <View style={styles.coverStats}>
          <View style={styles.stat}><Text style={styles.statValue}>{days.length}</Text><Text style={styles.statLabel}>días</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{summary.itemCount}</Text><Text style={styles.statLabel}>paradas</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{formatClp(summary.estimateClp)}</Text><Text style={styles.statLabel}>estimado</Text></View>
        </View>
      </Page>
      {days.map((day) => (
        <Page key={day.id} size="A4" style={styles.page}>
          <View style={styles.header} fixed><View><Text style={styles.eyebrow}>RUTA AUSTRAL</Text><Text style={styles.dayTitle}>{day.title}</Text><Text style={styles.dayMeta}>{day.date || 'Fecha por definir'} · {getDayItems(workspace, day.id).length} hitos</Text></View><Text>{activePlan?.name}</Text></View>
          {getDayItems(workspace, day.id).map((item) => (
            <View key={item.id} style={styles.item} wrap={false}>
              <Text style={styles.time}>{item.startTime || '—'}</Text>
              <View style={styles.itemBody}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemMeta}>{itemTypeMeta[item.type].label} · {item.location || 'Lugar por definir'} · {itemStatusMeta[item.status].label}</Text>{item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}</View>
              <Text style={styles.cost}>{item.actualClp || item.estimateClp ? formatClp(item.actualClp || item.estimateClp) : ''}</Text>
            </View>
          ))}
          <View style={styles.footer} fixed><Text>Ruta Austral · generado en este dispositivo</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} /></View>
        </Page>
      ))}
      {getUnassignedItems(workspace).length > 0 && (
        <Page size="A4" style={styles.page}><View style={styles.header}><Text style={styles.dayTitle}>Ideas sin asignar</Text></View>{getUnassignedItems(workspace).map((item) => <View key={item.id} style={styles.item}><Text style={styles.itemTitle}>{item.title}</Text></View>)}</Page>
      )}
    </Document>
  )
}

export async function downloadRoadbookPdf(workspace: Workspace): Promise<void> {
  const blob = await pdf(<RoadbookDocument workspace={workspace} />).toBlob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ruta-austral-${new Date().toISOString().slice(0, 10)}.pdf`
  anchor.rel = 'noopener'
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
