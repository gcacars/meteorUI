/*globals ko,ipc*/
let app;
let i18n;

// Context Menus
let contextProject = null;
const {remote} = require('electron');
const {Menu, MenuItem} = remote;

const projectMenu = new Menu();
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
	label: 'Remover projeto',
	click(){
		ipc.send('project-remove', contextProject);
	}
}));

// Initial data
ipc.on('start', function(e, ret) {

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

		app.showNPMpackages = ko.observable(true);
		app.showMDGpackages = ko.observable(false);
		app.showPackage = function(item){
			return (!item.mdg && !item.npm) ||
				(item.npm && app.showNPMpackages()) ||
				(item.mdg && app.showMDGpackages());
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

	app.projectCurrent(ret.data);
});

ipc.on('project-removed', function(e, ret) {
	if (ret.cod > 0){
		return modal(ret.message, ret.title, ret.type);
	}

	app.project.remove((p) => { return p.name === ret.name; });
});
