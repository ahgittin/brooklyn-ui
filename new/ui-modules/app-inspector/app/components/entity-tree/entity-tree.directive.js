/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import angular from 'angular';

import brooklynStatus from 'brooklyn-ui-utils/status/status';
import brWebNotifications from 'brooklyn-ui-utils/web-notifications/web-notifications';

import entityTreeTemplate from './entity-tree.html';
import entityNodeTemplate from './entity-node.html';
import {inspectState} from '../../views/main/inspect/inspect.controller';
import {summaryState} from '../../views/main/inspect/summary/summary.controller';
import {activitiesState} from '../../views/main/inspect/activities/activities.controller';
import {detailState} from '../../views/main/inspect/activities/detail/detail.controller';
import {managementState} from '../../views/main/inspect/management/management.controller';
import {detailState as managementDetailState} from '../../views/main/inspect/management/detail/detail.controller';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';

const MODULE_NAME = 'inspector.entity.tree';

angular.module(MODULE_NAME, [brooklynStatus, brWebNotifications])
    .directive('entityTree', entityTreeDirective)
    .directive('entityNode', entityNodeDirective);

export default MODULE_NAME;

export function entityTreeDirective() {
    return {
        restrict: 'E',
        template: entityTreeTemplate,
        controller: ['$scope', '$state', 'applicationApi', 'iconService', 'brWebNotifications', controller],
        controllerAs: 'vm'
    };

    function controller($scope, $state, applicationApi, iconService, brWebNotifications) {
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

        let vm = this;

        let observers = [];

        applicationApi.applicationsTree().then((response)=> {
            vm.applications = response.data;

            observers.push(response.subscribe((response)=> {
                response.data
                    .filter(x => vm.applications.map(y => y.id).indexOf(x.id) === -1)
                    .forEach((app) => {
                        spawnNotification(app, {
                            body: 'New application deployment. Current status: ' + app.serviceState,
                            data: $state.href('main.inspect.summary', {applicationId: app.id, entityId: app.id})
                        });
                    });
                vm.applications
                    .filter(x => response.data.map(y => y.id).indexOf(x.id) === -1)
                    .forEach((app) => {
                        spawnNotification(app, {
                            body: 'Application permanently un-deployed',
                            data: $state.href('main')
                        });
                    });

                vm.applications = response.data;

                function spawnNotification(app, opts) {
                    let baseType = app.type;
                    if (baseType === 'org.apache.brooklyn.entity.stock.BasicApplication' && app.children.length === 1) {
                        baseType = app.children[0].catalogItemId || app.children[0].type;
                    }
                    iconService.get(baseType).then((icon)=> {
                        let options = Object.assign({
                            icon: app.iconUrl || icon,
                        }, opts);

                        brWebNotifications.send('Brooklyn: ' + app.name, options);
                    });
                }
            }));
        });

        $scope.$on('$destroy', ()=> {
            observers.forEach((observer)=> {
                observer.unsubscribe();
            });
        });
    }
}

export function entityNodeDirective() {
    return {
        restrict: 'E',
        template: entityNodeTemplate,
        scope: {
            entity: '<',
            applicationId: '<',
        },
        link: link,
        controller: ['$scope', '$state', '$stateParams', controller]
    };

    function link($scope) {
        $scope.$on('notifyEntity', function (ev, data) {
            if ($scope.entity.id) {
                if (data.id !== $scope.entity.id) {
                    switch (data.message) {
                        case 'expandChildren':
                            $scope.isOpen = data.open;
                            $scope.isChildrenOpen = data.open;
                            break;
                        case 'openChildren' :
                            $scope.isOpen = data.open;
                    }
                }
            }
        });
    }

    function controller ($scope, $state, $stateParams) {
        $scope.isOpen = true;

        if ($stateParams.entityId === $scope.entity.id) {
            $scope.$emit('notifyEntity', {
                message: 'expandChildren',
                id: $scope.entity.id,
                open: true
            });
        }

        $scope.isSelected = function() {
            return $stateParams.entityId === $scope.entity.id;
        };

        $scope.getHref = function() {
            if ($state.current.name.startsWith(detailState.name)) {
                return $state.href(activitiesState.name, {
                    applicationId: $scope.applicationId,
                    entityId: $scope.entity.id
                });
            }
            if ($state.current.name.startsWith(managementDetailState.name)) {
                return $state.href(managementState.name, {
                    applicationId: $scope.applicationId,
                    entityId: $scope.entity.id
                });
            }
            if ($state.current.name.startsWith(inspectState.name)) {
                return $state.href($state.current.name, {
                    applicationId: $scope.applicationId,
                    entityId: $scope.entity.id
                });
            }
            return $state.href(summaryState.name, {
                applicationId: $scope.applicationId,
                entityId: $scope.entity.id
            });
        };

        $scope.onToggle = function ($event) {
            if ($event.shiftKey && $event.metaKey) {
                $scope.isChildrenOpen = !$scope.isChildrenOpen;
                $scope.$broadcast('notifyEntity', {
                    'message': 'expandChildren',
                    'id': $scope.entity.id,
                    'open': $scope.isChildrenOpen
                });
            } else {
                $scope.isOpen = true;
                $scope.isChildrenOpen = !$scope.isChildrenOpen;
                $scope.$broadcast('notifyEntity', {
                    'message': 'openChildren',
                    'id': $scope.entityId,
                    'open': $scope.isOpen
                });
            }
        };

    }
}
