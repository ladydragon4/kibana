/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { AlertStatus, ALERT_STATUS_ACTIVE, ALERT_STATUS_RECOVERED } from '@kbn/rule-data-utils';
import { WebElementWrapper } from '../../../../test/functional/services/lib/web_element_wrapper';
import { FtrProviderContext } from '../ftr_provider_context';

export function InfraHostsViewProvider({ getService }: FtrProviderContext) {
  const testSubjects = getService('testSubjects');

  return {
    async clickTryHostViewLink() {
      return await testSubjects.click('inventory-hostsView-link');
    },

    async clickTryHostViewBadge() {
      return await testSubjects.click('inventory-hostsView-link-badge');
    },

    async clickTableOpenFlyoutButton() {
      return testSubjects.click('hostsView-flyout-button');
    },

    async clickCloseFlyoutButton() {
      return testSubjects.click('euiFlyoutCloseButton');
    },

    async clickProcessesFlyoutTab() {
      return testSubjects.click('hostsView-flyout-tabs-processes');
    },

    async clickProcessesTableExpandButton() {
      return testSubjects.click('infraProcessRowButton');
    },

    async getHostsLandingPageDisabled() {
      const container = await testSubjects.find('hostView-no-enable-access');
      const containerText = await container.getVisibleText();
      return containerText;
    },

    async getHostsLandingPageDocsLink() {
      const container = await testSubjects.find('hostsView-docs-link');
      const containerText = await container.getAttribute('href');
      return containerText;
    },

    async getHostsLandingPageEnableButton() {
      const container = await testSubjects.find('hostsView-enable-feature-button');
      return container;
    },

    async clickEnableHostViewButton() {
      return await testSubjects.click('hostsView-enable-feature-button');
    },

    async getHostsTableData() {
      const table = await testSubjects.find('hostsView-table');
      return table.findAllByTestSubject('hostsView-tableRow');
    },

    async getHostsRowData(row: WebElementWrapper) {
      // Find all the row cells
      const cells = await row.findAllByCssSelector('[data-test-subj*="hostsView-tableRow-"]');

      // Retrieve content for each cell
      const [title, os, cpuUsage, diskLatency, rx, tx, memoryTotal, memory] = await Promise.all(
        cells.map((cell) => this.getHostsCellContent(cell))
      );

      return { title, os, cpuUsage, diskLatency, rx, tx, memoryTotal, memory };
    },

    async getHostsCellContent(cell: WebElementWrapper) {
      const cellContent = await cell.findByClassName('euiTableCellContent');
      return cellContent.getVisibleText();
    },

    async getMetricsTrendContainer() {
      return testSubjects.find('hostsView-metricsTrend');
    },

    async getChartsContainer() {
      return testSubjects.find('hostsView-metricChart');
    },

    getMetricsTab() {
      return testSubjects.find('hostsView-tabs-metrics');
    },

    async visitMetricsTab() {
      const metricsTab = await this.getMetricsTab();
      metricsTab.click();
    },

    async getAllMetricsTrendTiles() {
      const container = await this.getMetricsTrendContainer();
      return container.findAllByCssSelector('[data-test-subj*="hostsView-metricsTrend-"]');
    },

    async getMetricsTrendTileValue(type: string) {
      const container = await this.getMetricsTrendContainer();
      const element = await container.findByTestSubject(`hostsView-metricsTrend-${type}`);
      const div = await element.findByClassName('echMetricText__value');
      return await div.getAttribute('title');
    },

    async getAllMetricsCharts() {
      const container = await this.getChartsContainer();
      return container.findAllByCssSelector('[data-test-subj*="hostsView-metricChart-"]');
    },

    async getOpenInLensOption() {
      const metricCharts = await this.getAllMetricsCharts();
      const chart = metricCharts.at(-1)!;
      await chart.moveMouseTo();
      const button = await testSubjects.findDescendant('embeddablePanelToggleMenuIcon', chart);
      await button.click();
      await testSubjects.existOrFail('embeddablePanelContextMenuOpen');
      return testSubjects.existOrFail('embeddablePanelAction-openInLens');
    },

    // Flyout Tabs
    getMetadataTab() {
      return testSubjects.find('hostsView-flyout-tabs-metadata');
    },

    async getMetadataTabName() {
      const tabElement = await this.getMetadataTab();
      const tabTitle = await tabElement.findByClassName('euiTab__content');
      return tabTitle.getVisibleText();
    },

    async getProcessesTabContentTitle(index: number) {
      const processesListElements = await testSubjects.findAll('infraProcessesSummaryTableItem');
      return processesListElements[index].findByCssSelector('dt');
    },

    async getProcessesTabContentTotalValue() {
      const processesListElements = await testSubjects.findAll('infraProcessesSummaryTableItem');
      return processesListElements[0].findByCssSelector('dd');
    },

    getProcessesTable() {
      return testSubjects.find('infraProcessesTable');
    },

    async getProcessesTableBody() {
      const processesTable = await this.getProcessesTable();
      return processesTable.findByCssSelector('tbody');
    },

    // Logs Tab
    getLogsTab() {
      return testSubjects.find('hostsView-tabs-logs');
    },

    async visitLogsTab() {
      const logsTab = await this.getLogsTab();
      logsTab.click();
    },

    async getLogEntries() {
      const container = await testSubjects.find('hostsView-logs');

      return container.findAllByCssSelector('[data-test-subj*=streamEntry]');
    },

    // Alerts Tab
    getAlertsTab() {
      return testSubjects.find('hostsView-tabs-alerts');
    },

    getAlertsTabCountBadge() {
      return testSubjects.find('hostsView-tabs-alerts-count');
    },

    async getAlertsCount() {
      const alertsCountBadge = await this.getAlertsTabCountBadge();
      return alertsCountBadge.getVisibleText();
    },

    async visitAlertTab() {
      const alertsTab = await this.getAlertsTab();
      alertsTab.click();
    },

    setAlertStatusFilter(alertStatus?: AlertStatus) {
      const buttons = {
        [ALERT_STATUS_ACTIVE]: 'hostsView-alert-status-filter-active-button',
        [ALERT_STATUS_RECOVERED]: 'hostsView-alert-status-filter-recovered-button',
        all: 'hostsView-alert-status-filter-show-all-button',
      };

      const buttonSubject = alertStatus ? buttons[alertStatus] : buttons.all;

      return testSubjects.click(buttonSubject);
    },

    // Query Bar
    getQueryBar() {
      return testSubjects.find('queryInput');
    },

    async clearQueryBar() {
      const queryBar = await this.getQueryBar();

      return queryBar.clearValueWithKeyboard();
    },

    async typeInQueryBar(query: string) {
      const queryBar = await this.getQueryBar();

      return queryBar.type(query);
    },

    async submitQuery(query: string) {
      await this.typeInQueryBar(query);

      await testSubjects.click('querySubmitButton');
    },
  };
}
