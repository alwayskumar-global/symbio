# Evidence inventory

The authoritative inventories are `data/evidence/claims.csv` and `data/evidence/sources.json`. Each record states its subject, value, unit, physical and time basis, classification, source and locator, dates, effective period, derivation, uncertainty, reuse treatment, downstream use and collection. Access date for this reconstruction is 12 November 2026. Unknown dates and uncertainty ranges are explicit. A sourced account identifies its publisher and does not imply independent verification.

## Case evidence

| Claim | Use and limit |
|---|---|
| announcement-2017, announced-plant-scale | The 23 March 2017 project announcement covered local facilities and Copenhagen supply. Approximately 300,000 t/year and 8 million m³/year were forecasts for a wider plant boundary. They are excluded from the LP. [Announcement](https://orsted.dk/presse/nyheder/2017/03/residues-from-novo-nordisk-and-novozymes-to-be-converted-into-biogas) |
| baseline-agriculture, stream-basis | Pre-addition practice included agricultural use. The paper distinguishes wet biomass and downstream dewatered material. Represent Novo Yeast Cream and NovoGro at the modeled local transfer point only. Both quantities are assumptions. [Paper, pp. 5–6, Table 1 and footnote 7](https://www.symbiosis.dk/wp-content/uploads/2018/06/KalundborgSymbiosisPaperLCA2018-06.pdf) |
| digestion-pathway | Generic technical literature supports joint biogas/digestate production and gas upgrading. It supplies no local supplier-specific yield. [IEA Bioenergy Task 37, October 2009](https://task37.ieabioenergy.com/technical-reports/biogas-upgrading-technologies/) |
| operation-2018, inauguration | Spring commissioning and the 18 June 2018 inauguration are separate historical events. [Kalundborg Symbiosis](https://www.symbiosis.dk/en/2022/01/11/gron-energi/) · [Ministry speech](https://www.kefm.dk/aktuelt/nyheder/2018/jan/tale-til-indvielse-af-biogasanlaeg-kalundborg-d-18-juni-1) |
| operator-later-account, outlets | Later accounts describe a 2015 pilot, other feed and local/grid destinations. They support the historical comparison. [Bigadan case](https://bigadan.com/cases/kalundborg-bioenergy) · [Partner profile](https://www.symbiosis.dk/en/kalundborg-bioenergi/) |

## Design assumptions

Two local suppliers each provide an assumed 1,000 wet tonnes in one illustrative year. The equal round quantities allow independent removal tests. Their solids fractions, methane yield per tonne VS, retained nitrogen, process intake variants, operating coefficients, freight distances, agricultural receiving bounds, gas demand and grid cap are **scenario inputs**. They are neither historical measurements nor estimates of free supply. Each value and unit is available in the claims CSV and through the evidence endpoint. No sampling distribution or probability of failure is assigned.

The three fixed intake options illustrate partial and full nominal coverage of this dataset at one hypothetical site. The site has no verified land rights, engineering survey, grid agreement, supplier treatment specification, farm acceptance agreement or permit. Allocations require named what-if assumptions for the last four conditions and an explicit assumed site. A prohibition excludes that feed path. Where commercial rights to amend a direct delivery are absent, use the protected scenario. Removing a supplier releases only its supplier-contingent modeled obligation.

All dry gas volumes use 0 °C, 1 atm. Methane energy uses LHV. The two-component dry gas approximation accounts for methane and CO₂ mass, split into delivered methane, internally used methane, unrecovered methane and separated CO₂. Remaining wet mass goes to digestate. The bookkeeping assumes no added water, trace species or nitrogen loss. Nitrogen is the modeled agricultural service. Other nutrients, seasonal acceptance, storage, kinetics, logistics schedules and methane emissions impacts remain unresolved. External process and freight energy coefficients are unavailable, so every scenario reports delivered biomethane MWh/year. Freight is separately measured in wet tonne-km.

The input catalog cannot support a pre-announcement backtest, a net-energy comparison, financial viability, landfill diversion or a lifecycle assessment. The ranked result describes performance among the enumerated hypothetical configurations only. Historical outcome claims have no input edge from the model snapshot.
