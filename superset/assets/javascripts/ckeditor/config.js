/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see https://ckeditor.com/legal/ckeditor-oss-license
 */


CKEDITOR.editorConfig = function( config ) {
	config.language = 'zh-cn';

	// %REMOVE_START%
	// The configuration options below are needed when running CKEditor from source files.
	// 在这里添加新的插件
	config.plugins = 'dialogui,dialog,basicstyles' +
		',notification,button,toolbar,clipboard,panel,menu,contextmenu' +
		',resize,elementspath,enterkey,entities,popup,filetools,filebrowser,floatingspace' +
		',listblock,richcombo,format,horizontalrule,htmlwriter,wysiwygarea,image,indent' +
		',indentlist,fakeobjects,link,list,maximize,pastetext,pastetools,pastefromword' +
		',removeformat,showborders,menubutton,scayt,stylescombo,tab,table' +
		',tabletools,tableselection,undo,lineutils,widgetselection,widget,notificationaggregator' +
		',uploadwidget,uploadimage,wsc,justify,font';
	config.skin = 'moono-lisa';
	// %REMOVE_END%

	// Define changes to default configuration here.
	// For complete reference see:
	// https://ckeditor.com/docs/ckeditor4/latest/api/CKEDITOR_config.html

	// The toolbar groups arrangement, optimized for two toolbar rows.
	config.toolbar = [
		{ name: 'styles',   items: ['Format','FontSize'] },
		{ name: 'clipboard', items: ['Undo', 'Redo'] },
		{ name: 'insert', items: ['Image', 'Table'] },
		{ name: 'paragraph',   items: ['NumberedList', 'BulletedList', 'JustifyLeft'
		, 'JustifyCenter', 'JustifyRight', 'Indent', 'Outdent'] },
		{ name: 'basicstyles',   items: ['Bold', 'Italic'] },
		{ name: 'colors', items: ['TextColor', 'BGColor'] },
	];
	// Remove some buttons provided by the standard plugins, which are
	// not needed in the Standard(s) toolbar.
	config.removeButtons = 'Underline,Subscript,Superscript';

	// fontsize
	config.fontSize_sizes = '12/12px;14/14px;16/16px;24/24px;48/48px;';

	// Set the most common block elements.
	config.format_tags = 'p;h1;h2;h3;pre';

	// Simplify the dialog windows.
	config.removeDialogTabs = 'image:advanced;link:advanced';
	config.extraPlugins = 'uploadimage';

	// config.colorButton_enableMore = true;
	config.colorButton_colors = '000000,ffffff,FF0000,FF7D00,FFFF00,00FF00,00FFFF,0000FF,FF00FF';
	// config.extraPlugins = 'colordialog';
	config.extraPlugins = 'colorbutton,uploadimage,tablemenucustom';
	config.imageUploadUrl = '/ckeditoruploadapi/upload';
	config.filebrowserImageUploadUrl = "/ckeditoruploadapi/upload";
	config.image_previewText = ' ';

};
