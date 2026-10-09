import { geoArea, geoCentroid, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import worldAtlasSource from 'world-atlas/countries-110m.json?raw'
import { geographicCountryOptions } from '../lib/geographic-coverage'
import type { GeographicCoverageConfig } from '../lib/geographic-coverage'
import type { PositioningLanguage } from '../lib/site-positioning'

const worldAtlas = JSON.parse(worldAtlasSource) as Topology<{ countries: GeometryCollection }>
const countryFeatures = feature(worldAtlas, worldAtlas.objects.countries) as FeatureCollection<Geometry, { name?: string }>
const projection = geoNaturalEarth1().fitExtent([[24, 20], [976, 520]], countryFeatures)
const mapPath = geoPath(projection)

const getCountryCentroid = (countryId: string): [number, number] => {
  const country = countryFeatures.features.find((item) => String(item.id) === countryId)
  if (!country?.geometry) throw new Error(`Missing map feature for country ${countryId}`)

  if (country.geometry.type === 'MultiPolygon') {
    const polygons = country.geometry.coordinates.map((coordinates) => ({
      type: 'Feature' as const,
      properties: country.properties,
      geometry: { type: 'Polygon' as const, coordinates },
    }))
    const mainland = polygons.reduce((largest, polygon) => geoArea(polygon) > geoArea(largest) ? polygon : largest)
    return geoCentroid(mainland) as [number, number]
  }

  return geoCentroid(country) as [number, number]
}

interface GeographicCoverageMapProps {
  language: PositioningLanguage
  configuration: GeographicCoverageConfig
}

export default function GeographicCoverageMap({ language, configuration }: GeographicCoverageMapProps) {
  const countryName = (id: string) => geographicCountryOptions.find((country) => country.id === id)?.[language === 'fr' ? 'name_fr' : 'name_en'] ?? id
  const interventionNames = configuration.interventionCountryIds.map(countryName).join(', ')
  const clientNames = configuration.clientCountryIds.map(countryName).join(', ')
  const officeNames = configuration.officeCountryIds.map(countryName).join(', ')
  const officeMarkers = configuration.officeCountryIds.flatMap((id) => {
    try {
      return [{ id, coordinates: getCountryCentroid(id) }]
    } catch {
      return []
    }
  })
  const copy = language === 'fr'
    ? {
        title: 'Zones d’intervention et bureaux',
        interventionLabel: 'Zones d’intervention',
        clientLabel: 'Zones de clientèle',
        officeLabel: 'Bureaux',
        legend: 'Zone d’intervention',
        office: 'Bureau',
        clients: 'Zone de clientèle',
        mapDescription: 'Carte du monde montrant les zones d’intervention, les zones de clientèle et les bureaux.',
        mapTitle: 'Zones d’intervention de SCOPE-VERIFY et bureaux en France et au Maroc',
      }
    : {
        title: 'Operating areas and offices',
        interventionLabel: 'Operating areas',
        clientLabel: 'Client areas',
        officeLabel: 'Offices',
        legend: 'Operating area',
        office: 'Office',
        clients: 'Client area',
        mapDescription: 'World map showing operating areas, client areas and offices.',
        mapTitle: 'SCOPE-VERIFY operating areas and offices in France and Morocco',
      }

  return (
    <section className="geo-coverage section-pad" aria-labelledby="geo-coverage-title">
      <div className="geo-coverage-heading">
        <div>
          <p className="eyebrow">{language === 'fr' ? 'Couverture terrain' : 'Field coverage'}</p>
          <h2 id="geo-coverage-title">{copy.title}</h2>
        </div>
        <div className="geo-coverage-details">
          <p><strong>{copy.interventionLabel} :</strong> {interventionNames || '—'}</p>
          <p><strong>{copy.clientLabel} :</strong> {clientNames || '—'}</p>
          <p><strong>{copy.officeLabel} :</strong> {officeNames || '—'}</p>
        </div>
      </div>

      <figure className="geo-map-figure">
        <svg viewBox="0 0 1000 540" role="img" aria-labelledby="geo-map-title geo-map-description">
          <title id="geo-map-title">{copy.mapTitle}</title>
          <desc id="geo-map-description">{copy.mapDescription}</desc>
          <defs>
            <pattern id="geo-client-overlap" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" className="geo-client-pattern-base" />
              <rect width="3" height="8" className="geo-client-pattern-stripe" />
            </pattern>
          </defs>
          <g className="geo-map-countries">
            {countryFeatures.features.map((country: Feature<Geometry, { name?: string }>) => {
              const countryId = String(country.id ?? '')
              const isInterventionZone = configuration.interventionCountryIds.includes(countryId)
              const isClientZone = configuration.clientCountryIds.includes(countryId)
              const className = isInterventionZone && isClientZone
                ? 'geo-country geo-country-coverage geo-country-client-overlap'
                : isInterventionZone
                  ? 'geo-country geo-country-coverage'
                  : isClientZone
                    ? 'geo-country geo-country-client'
                    : 'geo-country'
              return <path key={countryId || country.properties?.name} d={mapPath(country) ?? ''} className={className} />
            })}
          </g>
          <g className="geo-map-offices">
            {officeMarkers.map((marker) => {
              const point = projection(marker.coordinates)
              if (!point) return null
              return (
                <g key={marker.id} transform={`translate(${point[0]},${point[1]})`} className="geo-office-marker" aria-label={copy.office}>
                  <circle r="7" />
                  <circle r="13" className="geo-marker-halo" />
                </g>
              )
            })}
          </g>
        </svg>
      </figure>

      <div className="geo-legend" aria-label={language === 'fr' ? 'Légende de la carte' : 'Map legend'}>
        <span><i className="geo-legend-swatch geo-legend-coverage" />{copy.legend}</span>
        <span><i className="geo-legend-swatch geo-legend-office" />{copy.office}</span>
        <span><i className="geo-legend-swatch geo-legend-client" />{copy.clients}</span>
      </div>
    </section>
  )
}