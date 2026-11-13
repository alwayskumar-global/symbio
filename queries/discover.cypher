MATCH (s:Snapshot {id:$snapshot})-[:INCLUDES]->(f:Facility)-[:PRODUCES]->(i:Stream)-[:IS_MATERIAL]->(m:Material)
MATCH (m)-[:ACCEPTED_BY]->(r:RuleVersion)-[:ENABLES]->(p:ProcessTemplate)
MATCH (p)-[:INCLUDES_STAGE]->(d:Stage)-[:INPUT]->(m)
MATCH (d)-[:PRODUCT]->(raw:Material {id:'raw-biogas'})<-[:INPUT]-(u:Stage)<-[:INCLUDES_STAGE]-(p)
MATCH (u)-[:PRODUCT]->(gas:Material {id:'biomethane'})
MATCH (p)-[:INCLUDES_STAGE]->(h:Stage)-[:PRODUCT]->(digestate:Material {id:'digestate'})
MATCH (h)-[:INPUT]->(m)
MATCH (p)-[:OUTPUT]->(gas:Material {id:'biomethane'})-[:ACCEPTED_AT]->(grid:Destination)
MATCH (p)-[:OUTPUT]->(digestate:Material {id:'digestate'})-[:ACCEPTED_AT]->(farm:Destination)
MATCH (p)-[:OPTION]->(c:Candidate)-[:AT]->(site:Site)
RETURN DISTINCT c.id AS id, i.id AS stream, f.id AS supplier, p.id AS process,
site.id AS site, grid.id AS grid, farm.id AS farm
ORDER BY id, stream
