/*globals ko,ipc*/
let app;
let i18n;
let contextProject = null;
let contextPackage = null;

// Initial data
ipc.on('start', function(e, ret) {

	const {remote} = require('electron');
	const {Menu, MenuItem} = remote;

	const projectMenu = new Menu();
	const packageMenu = new Menu();

	// Locale
	i18n = ret.i18n;

	// Model
	function appModel() {
		app = this;

		app.i18n = function(key){
			return i18n[ key ];
		};

		app.project = ko.observableArray([]);
		app.projectCurrent = ko.observable(null);

		app.setProject = function(data, event){
			if (event.which === 3){
				contextProject = data;
				projectMenu.popup(remote.getCurrentWindow());

			} else if (event.which === 1){
				app.project().forEach(function(p){
					if (p.current()) p.current(false);
				});

				data.current(true);
				ipc.send('project-select', data);
			}
		};

		app.currentFilter = ko.observable();
		app.showNPMpackages = ko.observable(true);
		app.showMDGpackages = ko.observable(false);
		app.showPackage = function(item){
			const filter = app.currentFilter();

			if (filter){
				return (item.name.toLocaleLowerCase().indexOf(filter) >= 0);
			} else {
				return (!item.mdg && !item.npm) ||
					(item.npm && app.showNPMpackages()) ||
					(item.mdg && app.showMDGpackages());
			}
		};
		app.setPackage = function(data, event){
			if (event.which === 3){
				data.projectPath = app.projectCurrent().project.path;
				contextPackage = data;
				packageMenu.popup(remote.getCurrentWindow());

			} else if (event.which === 1){

			}
		};
	}

	ko.applyBindings(new appModel());

	// Projects
	const projects = Object.keys(ret.projects);

	projects.forEach(function(name){
		const project = ret.projects[ name ];

		app.project.push({
			name: project.name,
			path: project.path,
			current: ko.observable(false)
		});
	});

	// Context Menus
	projectMenu.append(new MenuItem({
		label: 'MenuItem1',
		click(){
			console.log('item 1 clicked');
		}
	}));
	projectMenu.append(new MenuItem({
		type: 'separator'
	}));
	projectMenu.append(new MenuItem({
		label: i18n['ui.projects.contextmenu.remove'],
		click(){
			ipc.send('project-remove', contextProject);
		}
	}));

	packageMenu.append(new MenuItem({
		label: i18n['ui.packages.contextmenu.remove'],
		click(){
			ipc.send('package-remove', contextPackage);

			// Remove from UI
			const packages = app.projectCurrent().packages();
			const filtered = packages.filter((package) => {
				return package.id !== contextPackage.id;
			});

			app.projectCurrent().packages(filtered);
		}
	}));
});
ipc.send('start');

// Others
const $modal = $('.js-alert');
const $modalHead = $modal.find('.modal-header');
const $modalTitle = $modalHead.find('.modal-title');
const $modalBody = $modal.find('.modal-body');

const modal = function(msg, title, type){
	$modalHead.removeClass().addClass('modal-header bg-' + (type || ''));
	$modalTitle.text(title || 'Atenção');
	$modalBody.html(msg);
	$modal.modal('show');
};

// UI
$('.js-project-add').on('click', function(){
	ipc.send('project-open');
});

$('.js-project-create').on('click', function(){
	app.project().forEach(function(p){
		if (p.current()) p.current(false);
	});

	app.projectCurrent(null);
});

$(document).on('change', '.js-project-mdg', function(){
	var checked = $(this).is(':checked');
	app.showMDGpackages(checked);
});

$(document).on('change', '.js-project-npm', function(){
	var checked = $(this).is(':checked');
	app.showNPMpackages(checked);
});

ipc.on('project-selected', function(e, ret) {
	if (ret.cod > 0){
		return modal(ret.message, ret.title, ret.type);
	}

	ret.data.packages = ko.observableArray(ret.data.packages);

	app.projectCurrent(ret.data);
});

ipc.on('project-removed', function(e, ret) {
	if (ret.cod > 0){
		return modal(ret.message, ret.title, ret.type);
	}

	app.project.remove((p) => { return p.name === ret.name; });
});
