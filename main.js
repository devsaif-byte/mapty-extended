"use strict";
import { map } from "leaflet";
import "./style.css";
import { uid } from "uid";

const containerWorkouts = document.querySelector(".workouts");
const form = document.querySelector(".form");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const saveBtn = document.querySelector(".form__btn");

class Workout {
	date = new Date();
	uid = uid(7);
	clicks = 0;
	constructor(distance, duration, coordinates) {
		this.distance = distance;
		this.duration = duration;
		this.coordinates = coordinates;
	}

	_setDescription() {
		// prettier-ignore
		const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

		this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
			months[this.date.getMonth()]
		} ${this.date.getDate()}`;
	}

	click() {
		this.clicks++;
	}
}
// child classes
class Running extends Workout {
	type = "running";
	constructor(distance, duration, coordinates, cadence) {
		super(distance, duration, coordinates);
		this.cadence = cadence;
		this.calcPace();
		this._setDescription();
	}
	// One more property is PACE which need to calculate.
	// Created it outside of constructor and call it from inside.
	calcPace() {
		this.pace = this.duration / this.distance;
		return this.pace;
	}
}

class Cycling extends Workout {
	type = "cycling";
	constructor(distance, duration, coordinates, elevationGain) {
		super(distance, duration, coordinates);
		this.elevationGain = elevationGain;
		this.calcSpeed();
		this._setDescription();
	}
	// One more property is SPEED which need to calculate.
	// Created it outside of constructor and call it from inside.
	calcSpeed() {
		this.speed = this.distance / (this.duration / 60);
		return this.speed;
	}
}

class App {
	#map;
	#zoomLevel = 13;
	#mapEvent;
	#workouts = [];
	#editMode = false;
	#marker;
	constructor() {
		this._getPosition();
		this._getLocalStorage();

		// Attach event handler
		form.addEventListener("submit", this._createWorkout.bind(this));
		containerWorkouts.addEventListener("click", this._workoutClick.bind(this));
		inputType.addEventListener("change", this._toggleElevationField);
	}

	_getPosition() {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
				alert("Could not get your position")
			);
		}
	}

	_loadMap(position) {
		const { latitude, longitude } = position.coords;
		// store leaflet to map variable. given map coordinate for the center of the screen.
		// const map = L.map("map", {
		// 	center: [51.505, -0.09],
		// });
		// creating array from destructured object.
		const coords = [latitude, longitude];
		// setting mapView and mapZoom to the map property.
		this.#map = L.map("map").setView(coords, this.#zoomLevel);
		// getting map tiles from api using url and add to map property.
		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "© OpenStreetMap",
			detectRetina: true,
			crossOrigin: true,
		}).addTo(this.#map);

		// this line does bind the click event to showForm function. need to bind manually.
		// this.#map.on("click", this._mapClick.bind(this));
		this.#map.on("click", this._showForm.bind(this));
		this.#workouts.forEach((workout) => this._renderWorkoutMarker(workout));
	}

	_showForm(mapEvent) {
		console.log("Form opened!");
		// setting received argument to the mapEvent property
		this.#mapEvent = mapEvent;
		// remove the form hidden class from the DOM after click event happens.
		form.classList.remove("hidden");
		// focus immediately distance input
		inputDistance.focus();
		this.#editMode = false;
	}

	_hideForm() {
		inputDistance.value =
			inputDuration.value =
			inputCadence.value =
			inputElevation.value =
				"";
		// form.reset();
		form.style.display = "none";
		form.classList.add("hidden");
		setTimeout(() => (form.style.display = "grid"), 1000);
	}

	_toggleElevationField = () => {
		inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
		inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
	};

	// validations
	_validateInput = (...inputs) => inputs.every(Number.isFinite);
	_validateAllPositive = (...inputs) => inputs.every((elem) => elem > 0);

	_mapClick(mapEvent) {
		// Toggle between adding a new workout and editing an existing one
		if (this.#editMode) this._updateWorkout();
		else this._showForm(mapEvent);
	}

	// This is the method that does the main part of the JOB like input validation, workout creation, setting different events on the form, and rendering DOM using method calling.

	_createWorkout(event) {
		event.preventDefault();
		// get data from FORM (type, distance, duration, lat-lng)
		const type = inputType.value;
		const distance = +inputDistance.value;
		const duration = +inputDuration.value;
		const { lat, lng } = this.#mapEvent.latlng;
		console.log(this.#mapEvent);
		const coords = [lat, lng];
		// Creating workout objects
		let workout;
		// Check if you are in edit mode
		if (this.#editMode) {
			// If in edit mode, update the workout and exit edit mode
			const updatedWorkout = this._updateWorkout(this._editWorkout(workout));
			return updatedWorkout;
		}
		if (type === "running") {
			const cadence = +inputCadence.value;
			if (
				!this._validateInput(distance, duration, cadence) ||
				!this._validateAllPositive(distance, duration, cadence)
			)
				return alert("Inputs have to be positive numbers!");
			workout = new Running(distance, duration, coords, cadence);
		}
		if (type === "cycling") {
			const elevation = +inputElevation.value;
			if (
				!this._validateInput(distance, duration, elevation) ||
				!this._validateAllPositive(distance, duration, elevation)
			)
				return alert("Inputs have to be positive numbers!");
			workout = new Cycling(distance, duration, coords, elevation);
		}
		this._addWorkout(workout);
	}

	// Render submission process
	_addWorkout(workout) {
		// add newly created objects to the workout array
		this.#workouts.push(workout);
		// render workout on map as marker
		this._renderWorkoutMarker(workout);
		// render workout on list on the sidebar
		this._renderWorkout(workout);
		// hide form and clear inputs
		this._hideForm();
		// set all workout to the local storage
		this._setLocalStorage();
	}

	_workoutClick(event) {
		const editBtn = event.target.closest(".editBtn");
		const deleteBtn = event.target.closest(".deleteBtn");
		if (!editBtn && !deleteBtn) return;
		const workoutElement = event.target.closest(".workout");
		const workoutId = workoutElement.dataset.id;
		const workout = this.#workouts.find((w) => w.uid === workoutId);

		console.log(workout, workout.uid);
		if (editBtn) {
			this._editWorkout(workout);
		} else if (deleteBtn) {
			this._deleteWorkout(workout);
		}
	}

	_editWorkout(workout) {
		this.#editMode = true; // Set edit mode to true when editing
		this._showForm(this.#mapEvent); // Show the form for editing

		// Set the input values from the workout object
		inputType.value = workout.type;
		inputDistance.value = workout.distance;
		inputDuration.value = workout.duration;
		inputCadence.value = workout.cadence || "";
		inputElevation.value = workout.elevationGain || "";
		// Update the properties of the new object with the input values

		// Create an object to hold the input values
		const updatedWorkoutData = {
			type: inputType.value,
			distance: +inputDistance.value,
			duration: +inputDuration.value,
			cadence: +inputCadence.value || null, // Use null if not applicable
			elevationGain: +inputElevation.value || null, // Use null if not applicable
		};

		// Updated workout data will be all of objects
		console.log(updatedWorkoutData);
		this._deleteWorkout(workout);
		this._updateWorkout(workout, Object.assign(updatedWorkoutData, workout));

		this.#editMode = false;
	}

	_updateWorkout(workout, updatedWorkoutData) {
		console.log(workout, updatedWorkoutData);
		const wIndex = this.#workouts.findIndex((w) => w.uid === workout.uid);
		console.log(wIndex);
	}

	_updateUI(updatedWorkout) {
		const workoutElement = document.querySelector(
			`[data-id="${updatedWorkout.uid}"]`
		);
		if (!workoutElement) return;

		// You should create the updated HTML content here based on the updatedWorkout
		this._renderWorkout(updatedWorkout);
	}

	_removeWorkoutUI(workout) {
		const workoutElement = document.querySelector(`[data-id="${workout.uid}"]`);
		if (workoutElement) workoutElement.remove();
	}

	_deleteWorkout(workout) {
		const index = this.#workouts.findIndex((w) => w.uid === workout.uid);

		if (index === -1) return;

		this.#workouts.splice(index, 1);
		this.#map.removeLayer(this.#marker);

		this._setLocalStorage();
		this._removeWorkoutUI(workout);
	}

	_renderWorkoutMarker(workout) {
		this.#marker = L.marker(workout.coordinates)
			.addTo(this.#map)
			.bindPopup(
				L.popup({
					maxWidth: 250,
					minWidth: 100,
					autoClose: false,
					closeOnClick: false,
					className: `${workout.type}-popup`,
				})
			)
			.setPopupContent(
				`${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
			)
			.openPopup();
	}

	_renderWorkout(workout) {
		let html = `
    		<li class="workout workout--${workout.type}" data-id="${workout.uid}">
			
			<h2 class="workout__title">${workout.description}</h2>
			
          			<div class="workout__details">
						<span class="workout__icon">${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"}</span>
						<span class="workout__value">${workout.distance}</span>
            			<span class="workout__unit">km</span>
          			</div >
				<div class="workout__details">
					<span class="workout__icon">⏱</span>
					<span class="workout__value">${workout.duration}</span>
					<span class="workout__unit">min</span>
				</div>
				
		`;

		if (workout.type === "running")
			html += `
      			<div class="workout__details">
					<span class="workout__icon">⚡️</span>
					<span class="workout__value">${workout?.pace?.toFixed(1)}</span>
					<span class="workout__unit">min/km</span>
          		</div>
				<div class="workout__details">
					<span class="workout__icon">🦶🏼</span>
					<span class="workout__value">${workout?.cadence}</span>
					<span class="workout__unit">spm</span>
				</div>

				<div class="edit__workout">
					<a class="btn editBtn" data-id="${workout?.uid}">Edit</a>
					<a class="btn deleteBtn" data-id="${workout?.uid}">Delete</a>
				</div>
        	</li>`;

		if (workout.type === "cycling")
			html += `
				<div class="workout__details">
					<span class="workout__icon">⚡️</span>
					<span class="workout__value">${workout?.speed?.toFixed(1)}</span>
					<span class="workout__unit">km/h</span>
				</div>
				<div class="workout__details">
					<span class="workout__icon">⛰</span>
					<span class="workout__value">${workout?.elevationGain}</span>
					<span class="workout__unit">m</span>
				</div>
				<div class="edit__workout">
					<a class="btn editBtn" data-id="${workout?.uid}">Edit</a>
					<a class="btn deleteBtn" data-id="${workout?.uid}">Delete</a>
				</div>
    		</li>`;

		form.insertAdjacentHTML("afterend", html);
	}

	_moveToPopup(e) {
		const workoutEl = e.target.closest(".workout");
		if (!workoutEl) return;
		const workout = this.#workouts.find((e) => e.uid === workoutEl.dataset.id);

		this.#map.setView(workout.coordinates, this.#zoomLevel, {
			animate: true,
			pan: { duration: 1 },
		});
	}

	// Delete all workout
	_deleteAllWorkout() {}

	// Sort workouts by a certain field
	_sortWorkouts() {}

	// Realistic error and confirmation messages
	_showError() {}

	// Implementing local storage
	_setLocalStorage() {
		localStorage.setItem("workouts", JSON.stringify(this.#workouts));
	}

	_getLocalStorage() {
		const data = localStorage.getItem("workouts");
		if (!data) return;
		const parsedData = JSON.parse(data);
		// retrieved parsed objects from local storage loose its prototype chain. Merge class with parsed objects.
		const persist_Objs_Proto = parsedData.map((workout) => {
			console.log(workout);
			if (workout.type === "running") return structuredClone(workout);
			else if (workout.type === "cycling") return structuredClone(workout);
			else return workout;
		});
		this.#workouts = persist_Objs_Proto;

		console.log(parsedData);

		this.#workouts.forEach((workout) => this._renderWorkout(workout));
	}

	reset() {
		localStorage.removeItem("workouts");
		// location.reload();
	}
}

const app = new App();

// app.reset();
