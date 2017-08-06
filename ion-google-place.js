angular.module('ion-google-place', [])
    .directive('ionGooglePlace', [
        '$ionicTemplateLoader',
        '$ionicBackdrop',
        '$q',
        '$timeout',
        '$rootScope',
        '$document',
        '$cordovaGeolocation',
        '$ionicPlatform',
        function($ionicTemplateLoader, $ionicBackdrop, $q, $timeout, $rootScope, $document, $cordovaGeolocation, $ionicPlatform) {
            return {
                require: '?ngModel',
                restrict: 'E',
                template: '<input type="text" readonly="readonly" class="ion-google-place" autocomplete="on">',
                replace: true,
                scope: {
                    ngModel: '=?'
                },
                link: function(scope, element, attrs, ngModel) {
                    ngModel.$formatters.unshift(function (modelValue) {
                        if (!modelValue) return '';
                        return modelValue;
                    });

                    ngModel.$parsers.unshift(function (viewValue) {
                        return viewValue;
                    });

                    ngModel.$render = function(){
                        if(!ngModel.$modelValue && !ngModel.$viewValue){
                            element.val('');
                        } else {
                            if(typeof(ngModel.$modelValue) === 'string') element.val(ngModel.$modelValue);
                            else element.val(ngModel.$modelValue.description || ngModel.$viewValue.description || '');
                        }
                    };

                    scope.locations = [];
                    var geocoder = new google.maps.places.AutocompleteService();
                    var searchEventTimeout = undefined;

                    var currentLocation = (attrs.currentLocation && attrs.currentLocation.length) ? JSON.parse(attrs.currentLocation) : false;
                    var onlyCities = (attrs.onlyCities) ? true : false;
                    var POPUP_TPL = [
                        '<div class="ion-google-place-container">',
                        '<div class="bar bar-header item-input-inset">',
                        '<label class="item-input-wrapper">',
                        '<i class="icon ion-ios-search-strong placeholder-icon"></i>',
                        '<input class="google-place-search" type="search" ng-model="searchQuery" placeholder="Saisissez une adresse ou un lieu">',
                        '</label>',
                        '<span class="icon ion-close placeholder-icon" ng-show="searchQuery" ng-click="clearQuery()"></span>',
                        '<button class="button button-clear">',
                        'Annuler',
                        '</button>',
                        '</div>',
                        '<ion-content class="has-header has-header" overflow-scroll="true">',
                        '<div class="backdropRelease" ng-click="cancel()"></div>',
                        '<ion-list>',
                        (currentLocation) ? '<ion-item type="item-text-wrap" class="myPositionItem" ng-click="setCurrentLocation()">' : '',
                        (currentLocation) ? '<i class="icon ion-android-locate"></i> Ma position' : '',
                        (currentLocation) ? '</ion-item>' : '',
                        '<ion-item ng-repeat="location in locations" type="item-text-wrap" ng-click="selectLocation(location)">',
                        '{{location.description}}',
                        '</ion-item>',
                        '<ion-item class="powered-by-google">',
                        'powered by <img src="img/google.png">',
                        '</ion-item>',
                        '</ion-list>',
                        '</ion-content>',
                        '</div>'
                    ].join('');

                    var popupPromise = $ionicTemplateLoader.compile({
                        template: POPUP_TPL,
                        scope: scope,
                        appendTo: $document[0].body
                    });

                    popupPromise.then(function(el){
                        var searchInputElement = angular.element(el.element.find('input'));
                        scope.selectLocation = function(location){
                            ngModel.$setViewValue(location);
                            ngModel.$render();
                            el.element.css('display', 'none');
                            $ionicBackdrop.release();
                        };
                        scope.clearQuery = function(){
                            scope.searchQuery = "";
                        }
                        scope.cancel = function(){
                            scope.searchQuery = '';
                            $ionicBackdrop.release();
                            el.element.css('display', 'none');
                        }
                        scope.setCurrentLocation = function(){
                            var location = {
                                geolocalisation : 1,
                                description : 'GÃ©olocalisation en cours...',
                                lat: null,
                                lon: null,
                                done: false
                            };
                            ngModel.$setViewValue(location);
                            ngModel.$render();
                            el.element.css('display', 'none');
                            $ionicBackdrop.release();
                            var posOptions = {
                                enableHighAccuracy: false,
                                timeout: 5000,
                                maximumAge: 60000
                            };
                            $ionicPlatform.ready(function() {
                                $cordovaGeolocation.getCurrentPosition(posOptions).then(function (position) {
                                    location.lat  = position.coords.latitude;
                                    location.lon = position.coords.longitude;
                                    var geocoder = new google.maps.Geocoder;
                                    geocoder.geocode({'location': {lat : parseFloat(location.lat), lng : parseFloat(location.lon)}}, function(results, status) {
                                        if (status === google.maps.GeocoderStatus.OK) {
                                            if (results[0]) {
                                                location.done = true;
                                                location.description = results[0].formatted_address;
                                                ngModel.$setViewValue(location);
                                                ngModel.$render();
                                            } else {
                                                console.log('No results found');
                                            }
                                        } else {
                                            console.log('Geocoder failed due to: ' + status);
                                        }
                                    });
                                }, function(err) {
                                    location= {
                                        geolocalisation : -1,
                                        description : 'Erreur lors de la localisation',
                                        lat: null,
                                        lon: null
                                    };
                                    ngModel.$setViewValue(location);
                                    ngModel.$render();
                                });
                            });
                        }

                        scope.$watch('searchQuery', function(query){
                            if (searchEventTimeout) $timeout.cancel(searchEventTimeout);
                            searchEventTimeout = $timeout(function() {
                                if(!query) return;
                                if(query.length < 3);
                                var types = (onlyCities) ? ['cities'] : ['geocode',  'establishment'];
                                geocoder.getPlacePredictions(
                                    {
                                        input: query || '',
                                        types: types
                                    },
                                    function(results, status) {
                                        if (status == google.maps.GeocoderStatus.OK) {
                                            scope.$apply(function(){
                                                scope.locations = results;
                                            });
                                        } else {
                                            // @TODO: Figure out what to do when the geocoding fails
                                        }
                                    }
                                )
                            }, 350);
                        });

                        var onClick = function(e){
                            e.preventDefault();
                            e.stopPropagation();
                            $ionicBackdrop.retain();
                            el.element.css('display', 'block');
                            searchInputElement[0].focus();

                            if(searchInputElement[0].focus() != document.activeElement) {
                                var checkFocus = setInterval(function () {
                                    searchInputElement[0].focus();
                                    if (searchInputElement[0] == document.activeElement) {
                                        clearInterval(checkFocus);
                                    }
                                }, 100);
                            }
                        };

                        var onCancel = function(e){
                            scope.searchQuery = '';
                            $ionicBackdrop.release();
                            el.element.css('display', 'none');
                        };

                        element.bind('click', onClick);
                        element.bind('touchend', onClick);

                        el.element.find('button').bind('click', onCancel);
                    });

                    if(attrs.placeholder){
                        element.attr('placeholder', attrs.placeholder);
                    }
                }
            };
        }
    ]);