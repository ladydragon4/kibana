/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState, Fragment, FC, useMemo, useCallback } from 'react';
import { Router } from 'react-router-dom';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { CoreStart } from '@kbn/core/public';

import {
  EuiButtonEmpty,
  EuiPageContentBody,
  EuiPageHeader,
  EuiSpacer,
  EuiTabbedContent,
  EuiTabbedContentTab,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';

import type { UsageCollectionSetup } from '@kbn/usage-collection-plugin/public';
import type { DataPublicPluginStart } from '@kbn/data-plugin/public';
import type { ManagementAppMountParams } from '@kbn/management-plugin/public';
import {
  KibanaContextProvider,
  KibanaThemeProvider,
  RedirectAppLinks,
} from '@kbn/kibana-react-plugin/public';
import type { SharePluginStart } from '@kbn/share-plugin/public';
import type { SpacesPluginStart, SpacesContextProps } from '@kbn/spaces-plugin/public';
import type { FieldFormatsStart } from '@kbn/field-formats-plugin/public';
import { PLUGIN_ID } from '../../../../../../common/constants/app';

import { checkGetManagementMlJobsResolver } from '../../../../capabilities/check_capabilities';

// @ts-ignore undeclared module
import { JobsListView } from '../../../../jobs/jobs_list/components/jobs_list_view';
import { DataFrameAnalyticsList } from '../../../../data_frame_analytics/pages/analytics_management/components/analytics_list';
import {
  ModelsList,
  getDefaultModelsListState,
} from '../../../../trained_models/models_management/models_list';
import { AccessDeniedPage } from '../access_denied_page';
import { InsufficientLicensePage } from '../insufficient_license_page';
import { JobSpacesSyncFlyout } from '../../../../components/job_spaces_sync';
import { getDefaultAnomalyDetectionJobsListState } from '../../../../jobs/jobs_list/jobs';
import { getMlGlobalServices } from '../../../../app';
import { ListingPageUrlState } from '../../../../../../common/types/common';
import { getDefaultDFAListState } from '../../../../data_frame_analytics/pages/analytics_management/page';
import { ExportJobsFlyout, ImportJobsFlyout } from '../../../../components/import_export_jobs';
import type { JobType, MlSavedObjectType } from '../../../../../../common/types/saved_objects';
import { useMlKibana } from '../../../../contexts/kibana';

interface Tab extends EuiTabbedContentTab {
  'data-test-subj': string;
}

function usePageState<T extends ListingPageUrlState>(
  defaultState: T
): [T, (update: Partial<T>) => void] {
  const [pageState, setPageState] = useState<T>(defaultState);

  const updateState = useCallback(
    (update: Partial<T>) => {
      setPageState({
        ...pageState,
        ...update,
      });
    },
    [pageState]
  );

  return [pageState, updateState];
}

const getEmptyFunctionComponent: React.FC<SpacesContextProps> = ({ children }) => <>{children}</>;

function useTabs(isMlEnabledInSpace: boolean, spacesApi: SpacesPluginStart | undefined): Tab[] {
  const [adPageState, updateAdPageState] = usePageState(getDefaultAnomalyDetectionJobsListState());
  const [dfaPageState, updateDfaPageState] = usePageState(getDefaultDFAListState());
  const [modelListState, updateModelListState] = usePageState(getDefaultModelsListState());

  return useMemo(
    () => [
      {
        'data-test-subj': 'mlStackManagementJobsListAnomalyDetectionTab',
        id: 'anomaly-detector',
        name: i18n.translate('xpack.ml.management.jobsList.anomalyDetectionTab', {
          defaultMessage: 'Anomaly detection',
        }),
        content: (
          <Fragment>
            <EuiSpacer size="m" />
            <JobsListView
              jobsViewState={adPageState}
              onJobsViewStateUpdate={updateAdPageState}
              isManagementTable={true}
              isMlEnabledInSpace={isMlEnabledInSpace}
              spacesApi={spacesApi}
            />
          </Fragment>
        ),
      },
      {
        'data-test-subj': 'mlStackManagementJobsListAnalyticsTab',
        id: 'data-frame-analytics',
        name: i18n.translate('xpack.ml.management.jobsList.analyticsTab', {
          defaultMessage: 'Analytics',
        }),
        content: (
          <Fragment>
            <EuiSpacer size="m" />
            <DataFrameAnalyticsList
              isManagementTable={true}
              isMlEnabledInSpace={isMlEnabledInSpace}
              spacesApi={spacesApi}
              pageState={dfaPageState}
              updatePageState={updateDfaPageState}
            />
          </Fragment>
        ),
      },
      {
        'data-test-subj': 'mlStackManagementJobsListAnalyticsTab',
        id: 'trained-model',
        name: i18n.translate('xpack.ml.management.jobsList.trainedModelsTab', {
          defaultMessage: 'Trained models',
        }),
        content: (
          <Fragment>
            <EuiSpacer size="m" />
            <ModelsList
              isManagementTable={true}
              pageState={modelListState}
              updatePageState={updateModelListState}
            />
          </Fragment>
        ),
      },
    ],
    [
      isMlEnabledInSpace,
      adPageState,
      updateAdPageState,
      dfaPageState,
      updateDfaPageState,
      modelListState,
      updateModelListState,
    ]
  );
}

export const JobsListPage: FC<{
  coreStart: CoreStart;
  share: SharePluginStart;
  history: ManagementAppMountParams['history'];
  spacesApi?: SpacesPluginStart;
  data: DataPublicPluginStart;
  usageCollection?: UsageCollectionSetup;
  fieldFormats: FieldFormatsStart;
}> = ({ coreStart, share, history, spacesApi, data, usageCollection, fieldFormats }) => {
  const spacesEnabled = spacesApi !== undefined;
  const [initialized, setInitialized] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isPlatinumOrTrialLicense, setIsPlatinumOrTrialLicense] = useState(true);
  const [showSyncFlyout, setShowSyncFlyout] = useState(false);
  const [isMlEnabledInSpace, setIsMlEnabledInSpace] = useState(false);
  const tabs = useTabs(isMlEnabledInSpace, spacesApi);
  const [currentTabId, setCurrentTabId] = useState<MlSavedObjectType>('anomaly-detector');
  const I18nContext = coreStart.i18n.Context;
  const theme$ = coreStart.theme.theme$;

  const check = async () => {
    try {
      const { mlFeatureEnabledInSpace } = await checkGetManagementMlJobsResolver();
      setIsMlEnabledInSpace(mlFeatureEnabledInSpace);
    } catch (e) {
      if (e.mlFeatureEnabledInSpace && e.isPlatinumOrTrialLicense === false) {
        setIsPlatinumOrTrialLicense(false);
      } else {
        setAccessDenied(true);
      }
    }
    setInitialized(true);
  };

  useEffect(() => {
    check();
  }, []);

  const ContextWrapper = useCallback(
    spacesApi ? spacesApi.ui.components.getSpacesContextProvider : getEmptyFunctionComponent,
    [spacesApi]
  );

  if (initialized === false) {
    return null;
  }

  function renderTabs() {
    return (
      <EuiTabbedContent
        onTabClick={({ id }: { id: string }) => {
          setCurrentTabId(id as JobType);
        }}
        size="s"
        tabs={tabs}
        initialSelectedTab={tabs[0]}
      />
    );
  }

  function onCloseSyncFlyout() {
    setShowSyncFlyout(false);
  }

  if (accessDenied) {
    return <AccessDeniedPage />;
  }

  if (isPlatinumOrTrialLicense === false) {
    return <InsufficientLicensePage basePath={coreStart.http.basePath} />;
  }

  return (
    <RedirectAppLinks application={coreStart.application}>
      <I18nContext>
        <KibanaThemeProvider theme$={theme$}>
          <KibanaContextProvider
            services={{
              ...coreStart,
              share,
              data,
              usageCollection,
              fieldFormats,
              spacesApi,
              mlServices: getMlGlobalServices(coreStart.http, usageCollection),
            }}
          >
            <ContextWrapper feature={PLUGIN_ID}>
              <Router history={history}>
                <EuiPageHeader
                  pageTitle={
                    <FormattedMessage
                      id="xpack.ml.management.jobsList.jobsListTitle"
                      defaultMessage="Machine Learning"
                    />
                  }
                  description={
                    <FormattedMessage
                      id="xpack.ml.management.jobsList.jobsListTagline"
                      defaultMessage="View, export, and import machine learning analytics and anomaly detection items."
                    />
                  }
                  rightSideItems={[<DocsLink currentTabId={currentTabId} />]}
                  bottomBorder
                />

                <EuiSpacer size="l" />

                <EuiPageContentBody
                  id="kibanaManagementMLSection"
                  data-test-subj="mlPageStackManagementJobsList"
                >
                  <EuiFlexGroup>
                    <EuiFlexItem grow={false}>
                      {spacesEnabled && (
                        <>
                          <EuiButtonEmpty
                            onClick={() => setShowSyncFlyout(true)}
                            data-test-subj="mlStackMgmtSyncButton"
                          >
                            {i18n.translate('xpack.ml.management.jobsList.syncFlyoutButton', {
                              defaultMessage: 'Synchronize saved objects',
                            })}
                          </EuiButtonEmpty>
                          {showSyncFlyout && <JobSpacesSyncFlyout onClose={onCloseSyncFlyout} />}
                          <EuiSpacer size="s" />
                        </>
                      )}
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <ExportJobsFlyout
                        isDisabled={false}
                        currentTab={
                          currentTabId === 'trained-model' ? 'anomaly-detector' : currentTabId
                        }
                      />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <ImportJobsFlyout isDisabled={false} />
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  {renderTabs()}
                </EuiPageContentBody>
              </Router>
            </ContextWrapper>
          </KibanaContextProvider>
        </KibanaThemeProvider>
      </I18nContext>
    </RedirectAppLinks>
  );
};

const DocsLink: FC<{ currentTabId: MlSavedObjectType }> = ({ currentTabId }) => {
  const {
    services: {
      docLinks: {
        links: { ml },
      },
    },
  } = useMlKibana();

  let href = ml.anomalyDetectionJobs;
  let linkLabel = i18n.translate('xpack.ml.management.jobsList.anomalyDetectionDocsLabel', {
    defaultMessage: 'Anomaly detection jobs docs',
  });

  if (currentTabId === 'data-frame-analytics') {
    href = ml.dataFrameAnalytics;
    linkLabel = i18n.translate('xpack.ml.management.jobsList.analyticsDocsLabel', {
      defaultMessage: 'Analytics jobs docs',
    });
  } else if (currentTabId === 'trained-model') {
    href = ml.trainedModels;
    linkLabel = i18n.translate('xpack.ml.management.jobsList.trainedModelsDocsLabel', {
      defaultMessage: 'Trained models docs',
    });
  }
  return (
    <EuiButtonEmpty href={href} target="_blank" iconType="help" data-test-subj="documentationLink">
      {linkLabel}
    </EuiButtonEmpty>
  );
};
