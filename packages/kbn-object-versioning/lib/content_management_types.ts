/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { ObjectTransforms, Version, VersionableObject } from './types';

export interface ServicesDefinition {
  get?: {
    in?: {
      options?: VersionableObject<any, any, any, any>;
    };
    out?: {
      result?: VersionableObject<any, any, any, any>;
    };
  };
  bulkGet?: {
    in?: {
      options?: VersionableObject<any, any, any, any>;
    };
    out?: {
      result?: VersionableObject<any, any, any, any>;
    };
  };
  create?: {
    in?: {
      data?: VersionableObject<any, any, any, any>;
      options?: VersionableObject<any, any, any, any>;
    };
    out?: {
      result?: VersionableObject<any, any, any, any>;
    };
  };
  update?: {
    in?: {
      data?: VersionableObject<any, any, any, any>;
      options?: VersionableObject<any, any, any, any>;
    };
    out?: {
      result?: VersionableObject<any, any, any, any>;
    };
  };
  delete?: {
    in?: {
      options?: VersionableObject<any, any, any, any>;
    };
    out?: {
      result?: VersionableObject<any, any, any, any>;
    };
  };
  search?: {
    in?: {
      options?: VersionableObject<any, any, any, any>;
    };
    out?: {
      result?: VersionableObject<any, any, any, any>;
    };
  };
}

export interface ServiceTransforms {
  get: {
    in: {
      options: ObjectTransforms;
    };
    out: {
      result: ObjectTransforms;
    };
  };
  bulkGet: {
    in: {
      options: ObjectTransforms;
    };
    out: {
      result: ObjectTransforms;
    };
  };
  create: {
    in: {
      data: ObjectTransforms;
      options: ObjectTransforms;
    };
    out: {
      result: ObjectTransforms;
    };
  };
  update: {
    in: {
      data: ObjectTransforms;
      options: ObjectTransforms;
    };
    out: {
      result: ObjectTransforms;
    };
  };
  delete: {
    in: {
      options: ObjectTransforms;
    };
    out: {
      result: ObjectTransforms;
    };
  };
  search: {
    in: {
      options: ObjectTransforms;
    };
    out: {
      result: ObjectTransforms;
    };
  };
}

export interface ServiceDefinitionVersioned {
  [version: Version]: ServicesDefinition;
}
