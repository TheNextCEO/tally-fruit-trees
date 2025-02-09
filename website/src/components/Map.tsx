"use client";
interface MapProps {
  treeData: FeatureCollection;
}

import TreeInfoTooltip from "@/components/TreeInfoTooltip";
import { SelectedTreeInfo } from "@/types/trees";
import { Feature, FeatureCollection } from "geojson";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import NewTreeForm from "./NewTreeForm";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_REACT_APP_MAPBOX_TOKEN || "";

const Map = ({ treeData }: MapProps) => {
  const mapContainer = useRef(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const lat: number = 30.4543;
  const lng: number = -84.2875;
  const initZoom: number = 11.53;

  const [selectedTree, setSelectedTree] = useState<SelectedTreeInfo | null>(
    null
  );
  const [openToolbar, setOpenToolbar] = useState<boolean>(false);
  const [openNewTreeForm, setOpenNewTreeForm] = useState<boolean>(false);

  const [newTreeLocation, setNewTreeLocation] = useState<{
    latitude: number;
    longitude: number;
  }>({
    latitude: 0,
    longitude: 0,
  });

  useEffect(() => {
    if (mapRef.current) return; // Initialize map only once

    // ─────────────────────────────────────────────────────
    // Add map

    const initMap = () => {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current || "",
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        minZoom: 10,
        zoom: initZoom,
      });

      mapRef.current.on("load", () => {
        if (mapRef.current) {
          // Add a scale at the bottom right
          mapRef.current.addControl(
            new mapboxgl.NavigationControl(),
            "bottom-right"
          );

          // Create the GeolocateControl
          const geolocateControl = new mapboxgl.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true,
            },
            trackUserLocation: false,
            showUserHeading: true,
          });

          // Add the control to the map
          mapRef.current.addControl(geolocateControl, "bottom-right");

          // When user location is determined (the geolocate button is clicked or user is tracked)
          geolocateControl.on("geolocate", (e) => {
            // Get the user's location
            if (!mapRef.current) return;

            // Extract lat/lng from the geolocate event
            const currentLat = e.coords.latitude;
            const currentLng = e.coords.longitude;

            // Create a new GeoJSON feature
            const pointFeature: Feature = {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [currentLng, currentLat],
              },
              properties: {},
            };

            // Update the 'singleDot' source
            const singleDotSource = mapRef.current.getSource(
              "singleDot"
            ) as mapboxgl.GeoJSONSource;
            singleDotSource.setData({
              type: "FeatureCollection",
              features: [pointFeature],
            });

            // Update newTreeLocation state if needed
            setNewTreeLocation({
              latitude: currentLat,
              longitude: currentLng,
            });
          });

          // ─────────────────────────────────────────────────────
          // 1) Add ArcGIS Source & Layer for Fruit Trees
          // ─────────────────────────────────────────────────────
          mapRef.current.addSource("fruitTrees", {
            type: "geojson",
            data: treeData,
          });

          mapRef.current.addLayer({
            id: "treePoints",
            type: "circle",
            source: "fruitTrees",
            paint: {
              "circle-radius": 6,
              // "circle-color": [
              //   "match",
              //   ["get", "crash_type"],
              //   "Pedestrian",
              //   "#C4291D", // Red for Pedestrian
              //   "Bicyclist",
              //   "#F5AE3D", // Yellow for Bicyclist
              //   "#3C90E2", // Blue for Others
              // ],
              "circle-opacity": 0.6,
            },
          });

          // ─────────────────────────────────────────────────────
          // 2) Add a new source & layer for the single red dot
          //    Initialize with an empty FeatureCollection
          // ─────────────────────────────────────────────────────
          mapRef.current.addSource("singleDot", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });

          mapRef.current.addLayer({
            id: "singleDotLayer",
            type: "circle",
            source: "singleDot",
            paint: {
              "circle-radius": 6,
              "circle-color": "red",
              "circle-opacity": 1.0,
            },
          });

          // ─────────────────────────────────────────────────────
          // 3) Click event on "treePoints" to show the tooltip
          // ─────────────────────────────────────────────────────
          mapRef.current.on("click", "treePoints", (e) => {
            const features = e.features?.[0];

            if (features) {
              const coordinates =
                features.geometry.type === "Point"
                  ? features.geometry.coordinates
                  : [0, 0];
              setSelectedTree({
                properties: features.properties,
                coordinates: coordinates,
              });
              if (!openToolbar) setOpenToolbar(true);
            }
          });

          // Change the cursor to a pointer when over the points
          mapRef.current.on("mouseenter", "treePoints", () => {
            mapRef.current?.getCanvas().style.setProperty("cursor", "pointer");
          });

          mapRef.current.on("mouseleave", "treePoints", () => {
            mapRef.current?.getCanvas().style.setProperty("cursor", "");
          });

          // ─────────────────────────────────────────────────────
          // 4) Generic map click (outside treePoints)
          //    Update the 'singleDot' source with the new point
          // ─────────────────────────────────────────────────────
          mapRef.current.on("click", (e) => {
            if (!mapRef.current) return;

            // Check if the click hits any tree points
            const features = mapRef.current.queryRenderedFeatures(e.point, {
              layers: ["treePoints"],
            });

            // If no treePoints found => user clicked empty space
            if (!features.length) {
              const pointFeature: Feature = {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [e.lngLat.lng, e.lngLat.lat],
                },
                properties: {},
              };

              // Update 'singleDot' source to only have this one feature
              const singleDotSource = mapRef.current.getSource(
                "singleDot"
              ) as mapboxgl.GeoJSONSource;
              singleDotSource.setData({
                type: "FeatureCollection",
                features: [pointFeature],
              });

              setNewTreeLocation({
                latitude: e.lngLat.lat,
                longitude: e.lngLat.lng,
              });
            }
          });
        }
      });
    };

    initMap();
  }, []);

  useEffect(() => {
    if (openNewTreeForm) {
      setOpenToolbar(false);
    }
  }, [openNewTreeForm]);

  return (
    <>
      <TreeInfoTooltip
        selectedTree={selectedTree}
        open={openToolbar}
        setOpen={setOpenToolbar}
      />

      <NewTreeForm
        open={openNewTreeForm}
        setOpen={setOpenNewTreeForm}
        treeLocation={newTreeLocation}
      />

      <div
        ref={mapContainer}
        className="map-container h-[calc(100vh_-_68px)] w-full relative z-10"
      />
    </>
  );
};

export default Map;
