const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const fs = require('fs');
const windowStateKeeper = require('electron-window-state');
const settings = require('electron-settings');
const dialog = require('electron').dialog;
const y18n = require('y18n');
const i18n = y18n();

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// prevent window being garbage collected
let mainWindow;

function onClosed() {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}

function createMainWindow() {
	settings.delete('locale');

	// Load the previous state with fallback to defaults
	let mainWindowState = windowStateKeeper({
		defaultWidth: 1500,//900
		defaultHeight: 600,
		maximize: true
	});

	// Create the window using the state information
	const win = new BrowserWindow({
		'x': mainWindowState.x,
		'y': mainWindowState.y,
		'width': mainWindowState.width,
		'height': mainWindowState.height
	});

	win.loadURL(`file://${__dirname}/index.html`);
	win.on('closed', onClosed);

	// Let us register listeners on the window, so we can update the state
	// automatically (the listeners will be removed when the window is closed)
	// and restore the maximized or full screen state
	mainWindowState.manage(win);

	// Set language
	let locale = settings.get('locale');

	if (!locale){
		// Get OS locale
		const OSlocale = app.getLocale();

		// Check if exists language
		if (fs.existsSync('./locales/' + OSlocale + '.json')){
			settings.set('locale', OSlocale);
			locale = OSlocale;

		} else {
			settings.set('locale', 'en');
			locale = 'en';
		}
	}

	i18n.setLocale(locale);

	return win;
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (!mainWindow) {
		mainWindow = createMainWindow();
	}
});

app.on('ready', () => {
	mainWindow = createMainWindow();
});


ipcMain.on('start', function(e) {
	// Initial data
	const projects = settings.get('projects');
	if (!projects) settings.set('projects', {});

	// Send
	e.sender.send('start', {
		projects: projects,
		i18n: {
			'ui.projects': i18n.__('ui.projects'),
			'ui.projects.add': i18n.__('ui.projects.add'),
			'ui.projects.create': i18n.__('ui.projects.create'),
			'ui.projects.contextmenu.remove': i18n.__('ui.projects.contextmenu.remove'),
			'ui.welcome': i18n.__('ui.welcome'),
			'ui.packages': i18n.__('ui.packages'),
			'ui.packages.filter': i18n.__('ui.packages.filter'),
			'ui.packages.add.npm': i18n.__('ui.packages.add.npm'),
			'ui.packages.add.meteor': i18n.__('ui.packages.add.meteor'),
			'ui.packages.show.npm': i18n.__('ui.packages.show.npm'),
			'ui.packages.show.mdg': i18n.__('ui.packages.show.mdg')
		}
	});
});

ipcMain.on('project-open', function(e) {
	dialog.showOpenDialog({
		title: 'Escolha um projeto Meteor',
		properties: ['openDirectory']
	}, function (folders) {
		if (folders && folders[0]){
			const folder = folders[0];
			let returnObj = {};

			// Check for meteor data
			if (!fs.existsSync(folder + '\\.meteor')){
				returnObj = {
					cod: 2,
					message: 'Não é um projeto Meteor.<br>Clique em criar para começar um do zero.',
					title: 'Atenção',
					type: 'warning',
					data: {}
				};
			}

			// Check existing
			const name = folder.split(folder.indexOf('/') >= 0 ? '/' : '\\').pop();
			const project = settings.get('projects.' + name);

			if (project){
				// Check path
				const projectPath = project.path;

				if (projectPath === folder){
					returnObj = {
						cod: 2,
						message: 'Projeto já existe no seu local de trabalho.',
						title: 'Projeto existente',
						type: 'warning',
						data: {}
					};
				}
			}

			returnObj = {
				cod: 0,
				type: 'success',
				data: {
					name,
					path: folder
				}
			};

			// Save settings
			settings.set('projects.' + name, returnObj.data);

			e.sender.send('project-opened', returnObj);
		}
	});
});

ipcMain.on('project-remove', function(e, project) {
	// Save settings
	settings.delete('projects.' + project.name);
	e.sender.send('project-removed', project);
});

function getProjectPackages(projectPath){
	let packageList = [];

	// Meteor packages
	try {
		const fsPackages = fs.readFileSync(path.join(projectPath, '.meteor/versions'), {
			encoding: 'utf-8'
		});
		const packages = fsPackages.split('\n');

		packages.forEach((package) => {
			const data = package.trim().split('@');
			const mdg = (data[0].indexOf(':') < 0);
			const title = data[0].split(':');

			if (data.length === 2){
				packageList.push({
					name: mdg ? data[0] : title[1] + ` (${data[0]})`,
					version: data[1],
					mdg,
					npm: false
				});
			}
		});

	} catch(e){
		return {
			cod: 11,
			message: i18n.__('error.project.getmeteorpackages'),
			title: i18n.__('error.defaulttitle'),
			type: 'danger',
			data: {}
		};
	}

	// NPM packages


	// Ok
	return packageList;
}

ipcMain.on('project-select', function(e, project) {
	let returnObj = {};
	const projectPath = project.path;

	// Save settings
	//settings.delete('projects.' + project.name);

	// Get Meteor release
	const fsRelease = fs.readFileSync(path.join(projectPath, '.meteor/release'), {
		encoding: 'utf-8'
	});
	const releaseVersion = fsRelease.split('\n')[0].split('@')[1];

	// Get packages list
	const packages = getProjectPackages(projectPath);
	if (packages.cod) return packages;

	// Ok
	returnObj = {
		cod: 0,
		type: 'success',
		data: {
			project,
			version: releaseVersion,
			packages
		}
	};

	e.sender.send('project-selected', returnObj);
});
